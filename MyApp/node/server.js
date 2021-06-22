// /* Load the HTTP library */
// var http = require("http");
//
// /* Create an HTTP server to handle responses */
//
// http.createServer(function(request, response) {
//   response.writeHead(200, {"Content-Type": "text/plain"});
//   response.write("Hello World");
//   response.end();
// }).listen(8888);


const http = require('http')
const fs = require('fs')

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  fs.createReadStream('../public/index.html').pipe(res)
}).listen(8888);
