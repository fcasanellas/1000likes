/**
 * NodeJS code
 */

//SETUP
var express = require ('express');
var app = express();
var mongoose = require('mongoose');
var port = 3000;

//CONFIGURATION
mongoose.connect("mongodb://127.0.0.1:27017/1000Likes_v03"); //connect to MongoDB
app.use(express.static(__dirname + '/public')); // set the static files location
app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);

//MONGODB SCHEMAS & MODELS
//Schemas
var chatSchema = mongoose.Schema({
  created: Date,
  id1: String, //'GROUP' on groups and user1 in individual dialogs
  id2: String,
  category : Number, //0-Group, 1-With actor, 2-Betwen actors
  status : Number
});
var messageSchema = mongoose.Schema({
  created: Date,
  author: String,
  chat_id1: String,
  chat_id2: String,
  text: String
});
var userSchema = mongoose.Schema({
  created: Date,
  username: String,
  role: Number,
  status: Number
});
var petitionSchema = mongoose.Schema({
  created: Date,
  username: String,
  message: String,
  status: Number
});
//Models
var Chat = mongoose.model('chat', chatSchema);
var Message = mongoose.model('message', messageSchema);
var User = mongoose.model('user', userSchema);
var Petition = mongoose.model('petition', petitionSchema);
//Clean Models
Chat.remove({}, function(err) {console.log('Chats removed')});
Message.remove({}, function(err) {console.log('Messages removed')});
User.remove({}, function(err) {console.log('Users removed')});
Petition.remove({}, function(err) {console.log('Petitions removed')});

//Default data
var users = require('./default_data/users.json');
var groups = require('./default_data/groups.json');
var chat_index = require('./default_data/chat_index.json');
var defaults_schema = chat_index.schema;
chat_index = chat_index.chats;

setTimeout(function() {
  var load_users = [];
  for(var i=0;i<users.length;i++){
    var user = new User({
      created: new Date(),
      username: users[i].username,
      role: users[i].role,
      status: users[i].status
    });
    user.save(function(err, msg){});
    //Create chats betwen actors
    for(var j=0; j<load_users.length;j++){
      var chat = new Chat({
        created: new Date(),
        id1: load_users[j],
        id2: users[i].username,
        category: 2,
        status: 0
      });
      chat.save(function(err, msg){});
    }
    load_users[i] = users[i].username;
    console.log('USER '+users[i].username+' LOADED');
  }
  for(var i=0;i<groups.length;i++){
    var group = new Chat({
      created: new Date(),
      id1: groups[i].name,
      id2: 'GROUP',
      category: 1,
      status: groups[i].status
    });
    group.save(function(err, msg){});
  }
}, 3000);

//EXPRESS ROUTES
app.get("/", function(req, res){
    console.log('PAGE REQUEST');
    res.render("page");
});
app.get("/admin", function(req, res){
    res.render("admin");
});
app.get("/beamer", function(req, res){
    res.render("beamer");
});

//LOCAL VARS
var default_status = 0;

//SOCKET.IO
var io = require('socket.io').listen(app.listen(port));
var sockettree = {
  "beamer" : null,
  "admin" : null,
  "users" : {},
  "actors" : {}
};
//io.set('log level', 2); // reduce logging
io.sockets.on('connection', function (socket) {

    //Check device and store socket
    var device = socket.handshake.query.device;
    console.log('DEVICE CONNECTED TYPE '+device+': '+socket.id);
    if (device == "beamer") sockettree.beamer = socket;
    if (device == "admin") sockettree.admin = socket;

    //CHAT FUNCTIONS
    //New chatroom
    socket.on('chat:new', function(data){
      var chat = new Chat({
        created: new Date(),
        id1: data.id1,
        id2: data.id2,
        category: data.category,
        status: data.status
      });
      chat.save(function(err, msg){
        if (chat.category == 1){
          //If it's a groupchat, propagate to everybody
          socket.broadcast.emit('chat:new', data);
        }
      });
    });
    //Update chat
    socket.on('chat:update', function(chat){
      Chat.update({id1: chat.id1, id2: chat.id2}, {status: chat.status}, null, function(err, numAffected){
        if (err != null) {
          console.log('ERROR '+err);
        } else {
          if (chat.category == 1){
            //If it's a groupchat, propagate to everybody
            socket.broadcast.emit('chat:update', chat);
          }
        }
      });
    });
    //Load chats by category
    socket.on('chat:load_by_category', function(data){
      var util = require('util');
      switch (data.category) {
        case 0:
          if (data.role == 0) {
              Chat.find({id2: data.id, category: data.category}, function(err, res){
                if (res.length == 0) res = null;
                socket.emit('chat:load_by_category', res, data.category, data.chatscreen);
              });
            } else {
              Chat.find({id1: data.id, category: data.category}, function(err, res){
                if (res.length == 0) res = null;
                socket.emit('chat:load_by_category', res, data.category, data.chatscreen);
              });
            }
          break;
        case 1:
          Chat.find({category: 1}, function(err, res){
            if (res.length == 0) res = null;
            socket.emit('chat:load_by_category', res, 1, data.chatscreen);
          });
          break;
        case 2:
          Chat.find({$or:[{id2: data.id}, {id1: data.id}], category: data.category}, function(err, res){
            if (res.length == 0) res = null;
            socket.emit('chat:load_by_category', res, data.category, data.chatscreen);
          });
          break;
        }
    });
    //Load username chats
    socket.on('chat:load_by_user', function(data){
      var username = data.username;
      var role = data.role;
      if (role == 0) {
        //It's a normal user
        Chat.find({id2: username}, function(err, res){
          socket.emit('chat:load_by_user', res);
        });
      }else {
        //It's an actor
        Chat.find({id1: username}, function(err, res){
          socket.emit('chat:load_by_user', res);
        });
      }
    });
    //Load default chats index
    socket.on('chat:load_defaults_index', function(){
      socket.emit('chat:load_defaults_index', chat_index, defaults_schema);
    });

    //USER FUNCTIONS
    //On new user created
    socket.on('user:new', function(data) {
      var user = new User({
        created: new Date(),
        username: data.username,
        role: data.role,
        status: default_status
      });
      //Save it to database
      user.save(function(err, msg){});
      if (data.role == 0) {
        //If it isn't an actor, generate chatrooms with actors
        User.find({role: 1, status: {'$ne': 1}},function(err, res) {
          res.forEach(function(actor) {
            var chat = new Chat({
                created: new Date(),
                id1: actor.username,
                id2: data.username,
                category: 0,
                status: actor.status
            });
            chat.save(function(err, msg){});
            //Propagate the new chat to the actors
            if(sockettree.actors[actor.username]) sockettree.actors[actor.username].emit('chat:new', chat);
          });
        });
        socket.emit('user:new', user);
        //DEBUG ********************************
        console.log(user);
        socket.emit('user:created', data.username);
        // ************************************
        if(sockettree.admin) sockettree.admin.emit('user:new', user);
        //Store socket in sockettree
        sockettree.users[data.username] = socket;
        console.log('USER SOCKET REGISTERED ('+data.username+'): '+socket.id);

      } else {
        //TODO: En principi no es creen usuaris nous en directe per tant aquesta part deixaria de servir
        //If it's an actor, generate chatroooms with all users
        User.find({role: 0},function(err, res) {
          res.forEach(function(user) {
            var chat = new Chat({
                created: new Date(),
                id1: data.username,
                id2: user.username,
                category: 0,
                status: 0
            });
            chat.save(function(err, msg){
              //Propagate
              //TODO: S'està propagant el nou chat a tothom no només als implicats
              socket.broadcast.emit('chat:new', chat);
            });
          });
        });
      }
    });
    //Update user
    socket.on('user:update', function(user){
      User.update({username: user.username, role: user.role}, {status: user.status}, null, function(err, numAffected){
        if (err != null) {
          console.log('ERROR '+err);
        } else {
          //Update all user chats
          //En principi els no s'actualitza l'estat dels actors pel que aquesta part bo s'utilitza
          if (user.role == 1){
            Chat.update({id1: user.username, category: 0}, {status: user.status}, {multi: true}, function(err, numAffected){
              if (err != null) {
                console.log('ERROR '+err);
              }
            });
          }
          //TODO: Check if it's necessary propagate to everybody in all cases
          //socket.broadcast.emit('user:update', user);
          sockettree.users[user.username].emit('user:update', user);
        }
      });
    });
    //Load created user
    socket.on('user:load', function(username){
      User.findOne({username: username}, function(err,res){
        socket.emit('user:load', res);
        if (res) {
          //Store socket in sockettree
          if(res.role == 0) {
            sockettree.users[username] = socket;
            console.log('USER SOCKET REGISTERED ('+username+'): '+socket.id);
          } else {
            sockettree.actors[username] = socket;
            console.log('ACTOR SOCKET REGISTERED ('+username+'): '+socket.id);
          }
        }
      });
    });
    //Load all users by role
    socket.on('user:load_by_role', function(role){
      User.find({role: role}, function(err,res){
        socket.emit('user:load_by_role', res, role);
      });
    });
    //Update default status
    socket.on('user:update_default_status', function(status) {
      default_status = status;
    });


    //MESSAGE FUNCTIONS
    //New message created in any chatroom
    socket.on('message:new', function (data) {
      var newMsg = new Message({
        created: data.created,
        author: data.author,
        chat_id1: data.chat_id1,
        chat_id2: data.chat_id2,
        text: data.text
      });
      //Save it to database
      newMsg.save(function(err, msg){
        //Propagate
        socket.broadcast.emit('message:new', data);
      });
      //Update created value of the chatroom
      Chat.update({id1: data.chat_id1, id2: data.chat_id2},{created: new Date()},null, function(err, numAffected){});
    });
    //Get all messages of a chatroom
    socket.on('message:loadchatroom', function (data) {
      Message.find({'chat_id1': data.id1, 'chat_id2': data.id2}).sort({created: 'asc'}).exec(function(err, res) {
        socket.emit('message:loadchatroom', res, data.chatscreen);
      });
    });
    //Get all messages of a default chat
    socket.on('message:load_default_chat', function(data){
      var chat = chat_index[data.id];
      var messages = require('./default_data/'+chat.file);
      //Clean this chat on database
      Message.find({chat_id1: chat.id1, chat_id2: chat.id2}).remove(function(err, msg){});

      //Load default messages
      var date =  new Date();
      var time = date.getTime();
      for(var i=0; i<data.position; i++){
        var date =  new Date(time+i);
        var newMsg = new Message({
          created: date,
          author: messages[i].author,
          chat_id1: chat.id1,
          chat_id2: chat.id2,
          text: messages[i].text
        });
        //Save it to database
        newMsg.save(function(err, msg){});
      }

      //Update created value of the chatroom
      Chat.update({id1: chat.id1, id2: chat.id2}, {created: new Date()}, null, function(err, numAffected){});
      //Alert to reload if this is the current chatroom
      if(chat.category == 1) {
        socket.broadcast.emit('message:check_reload', chat);
      } else {
        if(sockettree.actors[chat.id1]) sockettree.actors[chat.id1].emit('message:check_reload', chat);
        if(sockettree.actors[chat.id2]) sockettree.actors[chat.id2].emit('message:check_reload', chat);
        if(sockettree.beamer) sockettree.beamer.emit('message:check_reload', chat);
      }
      if(sockettree.admin) sockettree.admin.emit('message:check_reload', chat);
      //Update and sync position
      chat_index[data.id].position = data.position;
      if(sockettree.admin) sockettree.admin.emit('chat:update_defaults_position', data.id, data.position);
    });

    //Increase default chat position
    socket.on('message:increase_default_chat', function (data) {
      var chat = chat_index[data.id];
      var messages = require('./default_data/'+chat.file);
      var message = messages[data.position];
      var newMsg = new Message({
        created: new Date(),
        author: message.author,
        chat_id1: chat.id1,
        chat_id2: chat.id2,
        text: message.text
      });
      //Save it to database
      newMsg.save(function(err, msg){
        //Propagate
        if(chat.category == 1) {
          socket.broadcast.emit('message:new', msg);
        } else {
          if(sockettree.actors[chat.id1]) sockettree.actors[chat.id1].emit('message:new', msg);
          if(sockettree.actors[chat.id2]) sockettree.actors[chat.id2].emit('message:new', msg);
          if(sockettree.beamer) sockettree.beamer.emit('message:new', msg);
        }
        if(sockettree.admin) sockettree.admin.emit('message:new', msg);
      });
      //Update created value of the chatroom
      Chat.update({id1: chat.id1, id2: chat.id2}, {created: new Date()}, null, function(err, numAffected){});
      //Update and sync position
      chat_index[data.id].position = data.position + 1;
      if(sockettree.admin) sockettree.admin.emit('chat:update_defaults_position', data.id, data.position + 1);
    });
    //Send messages to beamer
    socket.on('message:sendtobeamer', function (data) {
      if(data.id1 && data.id2) {
        Message.find({'chat_id1': data.id1, 'chat_id2': data.id2}).sort({created: 'asc'}).exec(function(err, res) {
          if (sockettree.beamer != null) {
            sockettree.beamer.emit('message:loadchatroom', res, data.chatscreen, data);
          }
        });
      } else {
        //Clean beamer chatscreen
        if (sockettree.beamer != null) {
          sockettree.beamer.emit('message:loadchatroom', null, data.chatscreen, data);
        }
      }
    });

    //PETITION FUNCTIONS
    socket.on('petition:send', function (data) {
      var petition = new Petition({
        created: new Date(),
        username: data.username,
        message: data.message,
        status: data.status
      });
      petition.save(function(err, msg){
        //Notify to admin
        sockettree.admin.emit('petition:new', petition);
      });
    });
    socket.on('petition:update', function (petition) {
      Petition.update({username: petition.username, message: petition.message}, {status: petition.status}, null, function(err, numAffected){
        if (err != null) {
          console.log('ERROR '+err);
        } else {
          //Propagate to affected user & admin
          if (petition.status == 1) {
            //Update user in database
            User.update({username: petition.username, role: 0}, {status: 3}, null, function(err, numAffected){
              if (err != null) {
                console.log('ERROR '+err);
              } else {
                  sockettree.admin.emit('user:update_status', petition.username, 3);
              }
            });
          }
          if(sockettree.users[petition.username]) sockettree.users[petition.username].emit('petition:response', petition.status);
        }
      });
    });
});

console.log("App listening on port "+port);
