import os
import sys
import csv
import time
import re
import psycopg2
from psycopg2.extras import execute_values

# ── 1. Helper: Parse .env file manually to avoid dependency ───────────────────
def load_env(env_path):
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                # Strip quotes
                val = val.strip().strip("'").strip('"')
                env_vars[key.strip()] = val
    return env_vars

# ── 2. Helper: Fuzzy match headers ───────────────────────────────────────────
def find_value(row_dict, exact_keys, partial_regex):
    # Try exact keys first
    for k in exact_keys:
        if k in row_dict and row_dict[k] is not None and str(row_dict[k]).strip() != '' and str(row_dict[k]) != '\\N':
            return row_dict[k], k
    # Try regex matching
    if partial_regex:
        for k in row_dict.keys():
            if partial_regex.search(k) and row_dict[k] is not None and str(row_dict[k]).strip() != '' and str(row_dict[k]) != '\\N':
                return row_dict[k], k
    return '', None

# ── 3. Main Import Loop ───────────────────────────────────────────────────────
def import_csv(csv_filepath, env_vars):
    # Get database connection config
    db_url = env_vars.get('DATABASE_URL')
    
    if db_url:
        print(f"Connecting to database via URL...")
        conn = psycopg2.connect(db_url)
    else:
        print(f"Connecting to database via separate parameters...")
        conn = psycopg2.connect(
            host=env_vars.get('DB_HOST', 'localhost'),
            port=int(env_vars.get('DB_PORT', 5432)),
            database=env_vars.get('DB_NAME', 'webdatabase'),
            user=env_vars.get('DB_USER', 'postgres'),
            password=env_vars.get('DB_PASSWORD', 'password')
        )
    
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Pre-query existing columns in contacts table
    cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'")
    existing_cols = {row[0].lower() for row in cursor.fetchall()}
    
    print("Pre-fetching schema complete. Core table structure recognized.")
    
    # Setup synonyms
    name_keys = ['name', 'full_name', 'fullname', 'legal_name', 'company_name', 'company', 'business_name', 'firm_name', 'firm', 'customer_name', 'client_name', 'owner_name', 'cname', 'fname', 'first_name', 'contact_name']
    name_regex = re.compile(r'name|cname|fname', re.IGNORECASE)
    
    mobile_keys = ['mobile', 'mobile_number', 'mobile_no', 'mobileno', 'mobilenum', 'mob_num', 'mob_no', 'phone', 'phone_number', 'phone_no', 'phoneno', 'phonenum', 'number', 'contact', 'contact_no', 'contact_num', 'contactno', 'contactnum', 'mob', 'cell', 'whatsapp', 'whatsapp_no']
    mobile_regex = re.compile(r'mob|phone|contact|number|num|tel', re.IGNORECASE)
    
    pin_keys = ['pincode', 'pin', 'zip', 'zipcode', 'postal_code', 'postalcode', 'pin_code', 'pincode_no']
    pin_regex = re.compile(r'pin|zip', re.IGNORECASE)
    
    city_keys = ['city', 'city_name', 'district', 'dist', 'pob', 'town']
    city_regex = re.compile(r'city|dist', re.IGNORECASE)
    
    state_keys = ['state', 'state_name', 'region']
    state_regex = re.compile(r'state|region', re.IGNORECASE)
    
    village_keys = ['village', 'location', 'area', 'town', 'village_name']
    village_regex = re.compile(r'village|loc|area', re.IGNORECASE)
    
    email_keys = ['email', 'email_id', 'emailid', 'email_address', 'emailaddress', 'mail', 'mail_id', 'mailid']
    email_regex = re.compile(r'email|mail', re.IGNORECASE)
    
    gender_keys = ['gender', 'sex']
    gender_regex = re.compile(r'gender|sex', re.IGNORECASE)
    
    address_keys = ['address', 'ladd', 'local_address', 'full_address', 'addr', 'location_address']
    address_regex = re.compile(r'addr|address', re.IGNORECASE)

    all_synonyms = set(name_keys + mobile_keys + pin_keys + city_keys + state_keys + village_keys + email_keys + gender_keys + address_keys)
    # Add minor variations
    all_synonyms.update(['add1', 'add2', 'add3', 'add4', 'add5'])

    print(f"Opening CSV file: {csv_filepath}...")
    file_size = os.path.getsize(csv_filepath)
    print(f"File size: {file_size / (1024*1024*1024):.2f} GB")
    
    start_time = time.time()
    total_processed = 0
    total_inserted = 0
    total_skipped = 0
    
    batch_size = 5000
    batch = []
    
    # Open CSV file stream
    with open(csv_filepath, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        try:
            headers = next(reader)
        except StopIteration:
            print("Error: CSV file is empty.")
            return
            
        # Clean headers to lowercase and trim
        headers = [h.strip().lower() for h in headers]
        
        # Scan and dynamically add missing columns based on headers first
        for header in headers:
            if not header or header == 'undefined' or header in all_synonyms:
                continue
            
            # Sanitize column name
            sanitized = re.sub(r'[^a-z0-9_]', '_', header)
            if re.match(r'^[0-9]', sanitized):
                sanitized = '_' + sanitized
            col_name = sanitized[:60]
            
            if col_name and col_name not in existing_cols:
                print(f"Adding dynamic column schema: {col_name}")
                cursor.execute(f'ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "{col_name}" TEXT')
                existing_cols.add(col_name)

        # Get list of all columns in the database now to prepare inserts
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'")
        db_columns = [row[0] for row in cursor.fetchall() if row[0] not in ('id', 'created_at', 'updated_at')]
        
        # Map DB column to its index in our values tuple
        col_indices = {col: i for i, col in enumerate(db_columns)}
        
        print("Starting batch inserts...")
        
        # Process rows
        for row in reader:
            if not row:
                continue
                
            total_processed += 1
            
            # Map row array to Dict for find_value lookup
            row_dict = {}
            for i, val in enumerate(row):
                if i < len(headers):
                    row_dict[headers[i]] = val
            
            # Extract standard fields
            name_val, name_key = find_value(row_dict, name_keys, name_regex)
            name_val = str(name_val).strip()
            
            mobile_val, mobile_key = find_value(row_dict, mobile_keys, mobile_regex)
            mobile_val = str(mobile_val).strip()
            
            # Skip rows missing required name or mobile
            if not name_val or not mobile_val:
                total_skipped += 1
                continue
                
            # Scientific format conversion
            if 'E' in mobile_val.upper():
                try:
                    mobile_val = str(int(float(mobile_val)))
                except ValueError:
                    pass

            # Extract other standard fields
            pin_val, _ = find_value(row_dict, pin_keys, pin_regex)
            city_val, _ = find_value(row_dict, city_keys, city_regex)
            state_val, _ = find_value(row_dict, state_keys, state_regex)
            village_val, _ = find_value(row_dict, village_keys, village_regex)
            email_val, _ = find_value(row_dict, email_keys, email_regex)
            
            # Address parsing (Merge split address parts if present)
            addr_parts = []
            addr_val, _ = find_value(row_dict, address_keys, address_regex)
            if addr_val:
                addr_parts.append(str(addr_val).strip())
            
            for k, val in row_dict.items():
                if re.match(r'^add[1-9]$', k) and val:
                    addr_parts.append(str(val).strip())
            address_val = ', '.join(addr_parts).strip()
            
            # Gender normalization
            gender_val, _ = find_value(row_dict, gender_keys, gender_regex)
            gender_val = str(gender_val).strip().lower()
            if gender_val.startswith('m'):
                gender_val = 'male'
            elif gender_val.startswith('f') or gender_val.startswith('w'):
                gender_val = 'female'
            elif gender_val.startswith('o'):
                gender_val = 'other'
            else:
                gender_val = 'male'
                
            # Populate contact values tuple matching db_columns
            val_tuple = [None] * len(db_columns)
            
            # Standard columns mapping
            val_tuple[col_indices['name']] = name_val
            val_tuple[col_indices['mobile']] = mobile_val
            val_tuple[col_indices['gender']] = gender_val
            if 'address' in col_indices: val_tuple[col_indices['address']] = address_val
            if 'city' in col_indices: val_tuple[col_indices['city']] = city_val
            if 'state' in col_indices: val_tuple[col_indices['state']] = state_val
            if 'village' in col_indices: val_tuple[col_indices['village']] = village_val
            if 'pincode' in col_indices: val_tuple[col_indices['pincode']] = pin_val
            if 'email' in col_indices: val_tuple[col_indices['email']] = email_val
            
            # Populate dynamic columns
            for k, val in row_dict.items():
                if not k or k == 'undefined' or k in all_synonyms:
                    continue
                sanitized = re.sub(r'[^a-z0-9_]', '_', k)
                if re.match(r'^[0-9]', sanitized):
                    sanitized = '_' + sanitized
                col_name = sanitized[:60]
                
                if col_name in col_indices:
                    val_tuple[col_indices[col_name]] = str(val).strip()
            
            batch.append(tuple(val_tuple))
            
            # Execute batch insert
            if len(batch) >= batch_size:
                # Build execute statement
                columns_str = ', '.join(f'"{col}"' for col in db_columns)
                query = f'INSERT INTO contacts ({columns_str}) VALUES %s ON CONFLICT (mobile) DO NOTHING'
                
                before_count = get_row_count(cursor)
                execute_values(cursor, query, batch)
                after_count = get_row_count(cursor)
                
                inserted_this_batch = after_count - before_count
                total_inserted += inserted_this_batch
                total_skipped += (len(batch) - inserted_this_batch)
                
                batch = []
                
                # Live reporting
                elapsed = time.time() - start_time
                speed = total_processed / elapsed if elapsed > 0 else 0
                print(f"[Progress] Processed: {total_processed:,} rows | Inserts: {total_inserted:,} | Skipped: {total_skipped:,} | Speed: {speed:.1f} rows/s | Elapsed: {int(elapsed)}s")
        
        # Insert remaining batch records
        if batch:
            columns_str = ', '.join(f'"{col}"' for col in db_columns)
            query = f'INSERT INTO contacts ({columns_str}) VALUES %s ON CONFLICT (mobile) DO NOTHING'
            before_count = get_row_count(cursor)
            execute_values(cursor, query, batch)
            after_count = get_row_count(cursor)
            inserted_this_batch = after_count - before_count
            total_inserted += inserted_this_batch
            total_skipped += (len(batch) - inserted_this_batch)

    # Log final activity log in database
    elapsed = time.time() - start_time
    summary_desc = f"Imported {total_inserted} contacts ({total_skipped} skipped/duplicates) from massive file in {elapsed:.1f}s"
    print(f"\n[Success] Import Completed Successfully!")
    print(f"Total Processed: {total_processed:,} rows")
    print(f"Successfully Inserted: {total_inserted:,} rows")
    print(f"Skipped / Duplicates: {total_skipped:,} rows")
    print(f"Execution Time: {elapsed:.2f} seconds")
    print(f"Average Speed: {total_processed / elapsed:.1f} rows/second")
    
    try:
        # Get super admin user ID to log activity
        cursor.execute("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1")
        admin_id = cursor.fetchone()[0]
        cursor.execute(
            'INSERT INTO activity_logs (user_id, action, description) VALUES (%s, %s, %s)',
            (admin_id, 'IMPORT_CONTACTS', f"{summary_desc} [CLI]")
        )
        print("Activity logged successfully in database.")
    except Exception as e:
        print(f"Warning: Could not log activity: {e}")
        
    cursor.close()
    conn.close()

def get_row_count(cursor):
    cursor.execute("SELECT count(*) FROM contacts")
    return cursor.fetchone()[0]

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_massive_csv.py <path_to_csv_file>")
        sys.exit(1)
        
    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f"Error: File '{csv_path}' does not exist.")
        sys.exit(1)
        
    # Find .env file in parent directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, '../.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(script_dir, '../../.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.getcwd(), '.env')
        
    print(f"Loading environment variables from: {env_path}")
    env_vars = load_env(env_path)
    
    import_csv(csv_path, env_vars)
