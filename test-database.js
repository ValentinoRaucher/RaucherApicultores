const db = require('./config/database.js');

// Test database schema
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('Error checking tables:', err);
  } else {
    console.log('Tables found:', tables.map(t => t.name));
    
    // Check buyers table structure
    db.all('PRAGMA table_info(buyers)', (err, buyerColumns) => {
      if (err) {
        console.error('Error checking buyers table:', err);
      } else {
        console.log('Buyers table columns:', buyerColumns.map(c => c.name));
      }
      
      // Check orders table structure
      db.all('PRAGMA table_info(orders)', (err, orderColumns) => {
        if (err) {
          console.error('Error checking orders table:', err);
        } else {
          console.log('Orders table columns:', orderColumns.map(c => c.name));
        }
        
        db.close();
      });
    });
  }
});
