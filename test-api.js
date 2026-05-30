const http = require('http');

// Test 1: Get API endpoint
console.log('\n=== TEST 1: API ROOT ===');
http.get('http://localhost:5000/api', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✓ API Root:', json.message);
      console.log('✓ Version:', json.version);
    } catch (e) {
      console.log('✗ Error:', e.message);
    }
    
    // Test 2: Get properties
    console.log('\n=== TEST 2: FETCH PROPERTIES ===');
    http.get('http://localhost:5000/api/properties?limit=1', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            const prop = json.data[0];
            console.log('✓ Property:', prop.name);
            
            if (prop.roomTypes && prop.roomTypes.length > 0) {
              const room = prop.roomTypes[0];
              console.log('✓ Room:', room.name);
              console.log('✓ Room ID:', room.id);
              console.log('✓ Capacity:', room.capacity);
              console.log('✓ Total Count:', room.totalCount);
              console.log('✓ Price:', room.pricePerNight);
              
              // Test 3: Calendar availability
              console.log('\n=== TEST 3: CALENDAR AVAILABILITY ===');
              const startDate = '2026-05-15';
              const endDate = '2026-05-25';
              http.get(`http://localhost:5000/api/inventory/calendar?roomId=${room.id}&startDate=${startDate}&endDate=${endDate}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  try {
                    const cal = JSON.parse(data);
                    if (Array.isArray(cal)) {
                      console.log(`✓ Calendar fetched for ${cal.length} days`);
                      console.log('✓ Sample dates:');
                      cal.slice(0, 3).forEach(d => {
                        console.log(`  - ${d.date}: ${d.available} rooms available`);
                      });
                    }
                  } catch (e) {
                    console.log('✗ Error:', e.message);
                  }
                });
              });
            }
          }
        } catch (e) {
          console.log('✗ Error:', e.message);
        }
      });
    });
  });
});
