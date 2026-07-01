const fs = require('fs');
try {
  const route = fs.readFileSync('/proc/net/route', 'utf8');
  const lines = route.split('\n');
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length > 2 && parts[1] === '00000000') {
      const hex = parts[2];
      const ip = [
        parseInt(hex.substring(6, 8), 16),
        parseInt(hex.substring(4, 6), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(0, 2), 16)
      ].join('.');
      console.log(ip);
      process.exit(0);
    }
  }
} catch (e) {
  // Fallback to default Docker gateway if /proc/net/route fails
  console.log('172.17.0.1');
}
