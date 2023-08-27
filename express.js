const express = require('express');
const CloudinaryProcess = require('./api/CloudinaryProcess'); // 您的函数文件路径

const app = express();
const port = 3001; // 可以根据需要更改端口号

app.post('/test', (req, res) => CloudinaryProcess(req, res));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
