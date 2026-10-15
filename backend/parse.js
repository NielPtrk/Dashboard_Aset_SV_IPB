const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'src', 'storage', 'data_Excel');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
  console.log(`\n--- Reading ${file} ---`);
  const workbook = xlsx.readFile(path.join(dataDir, file));
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Get data as JSON
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (data.length > 0) {
    const headers = data[0];
    console.log('Columns:', headers);
    if (data.length > 1) {
      console.log('Sample Row 1:', data[1]);
    }
  } else {
    console.log('Empty sheet');
  }
});
