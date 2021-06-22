var express = require('express'); // Express web server framework
var app = express();

app.get('/login', function(req, res) {
  console.log("login");
});

app.all('', function(req, res){
  console.log("all");
});

app.get('/', function(req, res){
  console.log("/");
    res.redirect('/user');
});

app.get('/user', function(req, res){
  console.log("/user");
    res.send("Redirected to User Page");
});

app.listen(8888, function(err){
    if (err) console.log(err);
    console.log("Server listening on PORT", 8888);
});
