const bcrypt = require('bcryptjs');

const hashedPassword = '$2a$12$YNbhsEzSybAM/gWJYR4hFe3IlWq56mW2Etb0uzn5iaEA25CGg7.9K';
const defaultPassword = 'triprodeo2025';

async function test() {
  console.log('Testing password: ' + defaultPassword);
  console.log('Hash: ' + hashedPassword);
  
  const isValid = await bcrypt.compare(defaultPassword, hashedPassword);
  console.log('Password valid:', isValid);
  
  // Also try hashing the password to compare
  const newHash = await bcrypt.hash(defaultPassword, 12);
  console.log('\nNew hash:', newHash);
  
  // Try some other common passwords
  const passwords = ['triprodeo', 'admin123', 'password', 'admin', 'Triprodeo@123', ''];
  console.log('\nTrying other passwords:');
  for (const pwd of passwords) {
    const valid = await bcrypt.compare(pwd, hashedPassword);
    console.log(`  "${pwd}": ${valid}`);
  }
}

test();
