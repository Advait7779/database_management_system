import csv
import random
import os

def generate_mock_csv(filename, count=50000):
    first_names = ['Amit', 'Rahul', 'Sanjay', 'Sunil', 'Vijay', 'Anil', 'Deepak', 'Rajesh', 'Sachin', 'Vikram', 'Pooja', 'Neha', 'Priya', 'Jyoti', 'Kiran', 'Aarti', 'Anjali', 'Meena']
    last_names = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Joshi', 'Mehta', 'Singh', 'Kumar', 'Pawar', 'Deshmukh', 'Kulkarni', 'Shinde', 'Jadhav', 'Patil']
    cities = ['Pune', 'Mumbai', 'Thane', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur']
    states = ['Maharashtra']
    genders = ['Male', 'Female']
    
    # Standard columns and some custom dynamic columns
    headers = [
        'full_name', 'mob_num', 'sex', 'local_address', 'city_name', 'state', 'pin_code', 'email_address',
        'sr_no_', 'company_name', 'extra_notes'
    ]
    
    print(f"Generating {count:,} mock rows in {filename}...")
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        for i in range(1, count + 1):
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            # Generate random unique-ish 10 digit number
            mobile = f"98{random.randint(10000000, 99999999)}"
            gender = random.choice(genders)
            address = f"Flat {random.randint(101, 909)}, Building {random.randint(1, 40)}, Sector {random.randint(1, 20)}"
            city = random.choice(cities)
            state = random.choice(states)
            pincode = f"411{random.randint(10, 99):02}"
            email = f"{name.lower().replace(' ', '_')}@example.com"
            sr_no = str(i)
            company = f"{random.choice(['Tata', 'Reliance', 'Infosys', 'Wipro', 'Adani', 'Mahindra'])} Group"
            notes = random.choice(['Active lead', 'Contacted yesterday', 'Interested', 'Follow up next week', '\\N', ''])
            
            writer.writerow([name, mobile, gender, address, city, state, pincode, email, sr_no, company, notes])
            
            if i % 10000 == 0:
                print(f"Generated {i:,} / {count:,} rows...")
                
    print(f"Mock CSV generation complete: {filename}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(script_dir, '../uploads/mock_contacts.csv')
    generate_mock_csv(target_path, 50000)
