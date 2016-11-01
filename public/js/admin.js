(function(){
  var app = angular.module('1000likes', ['ngCookies', 'luegg.directives', 'sc.twemoji', 'ngSanitize']);

  //CONFIGURATION
  app.config(function(twemojiProvider) {
    twemojiProvider.setOptions({
      base: '/libs/twemoji/',
      size: 'svg',
      ext: '.svg',
    });
  });

  //SERVICES
  //Service to interact with the socket library
  app.factory('socket', function ($rootScope) {
    var socket = io.connect('', {query:"device=admin"});
    return {
      on: function (eventName, callback) {
        socket.on(eventName, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        });
      },
      emit: function (eventName, data, callback) {
        socket.emit(eventName, data, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        })
      }
    };
  });

  //Custom filter to sort objects
  app.filter('orderObjectBy', function() {
    return function(items, field, reverse) {
      var filtered = [];
      angular.forEach(items, function(item) {
        filtered.push(item);
      });
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  });

  app.controller('AdminController', function($scope, socket, $timeout){
    //Define glued setting
    $scope.glued = true;

    //Deife participation setting
    $scope.bulk_status = 0;
    $scope.petitions = [];

    //Define arrays for current user and more
    $scope.current_user = {admin: null, admin2: null};
    $scope.actorchats = {admin: null, admin2: null};
    $scope.userchats = {admin: null, admin2: null};
    $scope.groupchats = {admin: null, admin2: null};
    $scope.current_chatroom = {admin: null, admin2: null};
    $scope.messages = {admin: null, admin2: null};
    $scope.beamerchats = {beamer: null, beamer2: null};
    $scope.users = {};
    $scope.actors = {};
    $scope.messages_stack = [];

    //Load actors, users and groups
    socket.emit('user:load_by_role', 1);
    socket.emit('user:load_by_role', 0);
    socket.emit('chat:load_by_category', {category: 1});
    socket.emit('chat:load_defaults_index');

    //SOCKET LISTENERS
    //Recive new user creation
    socket.on('user:new', function(user) {
      if (user.role == 0) {
        $scope.users[user.username] = user;
      } else if (role == 1) {
        $scope.actors[user.username] = user;
      }
    });
    //Recive users by role
    socket.on('user:load_by_role', function(data, role) {
      if (role == 0) {
        for (i = 0; i < data.length; i++) {
          $scope.users[data[i].username] = data[i];
        }
      } else if (role == 1) {
        for (i = 0; i < data.length; i++) {
          $scope.actors[data[i].username] = data[i];
        }
      }
    });
    //Update user
    socket.on('user:update_status', function(username, status) {
      $scope.users[username].status = status;
    });
    //Recive chats by category
    socket.on('chat:load_by_category', function(data, category, chatscreen) {
      if (chatscreen) {
        //Load actor and group chats in chatscreen
        if (category == 0) {
          if ($scope.current_user[chatscreen].role == 0) {
            if ($scope.actorchats[chatscreen] == null) $scope.actorchats[chatscreen] = {};
            for (i = 0; i < data.length; i++) {
              $scope.actorchats[chatscreen][data[i].id1+'_'+data[i].id2] = data[i];
              $scope.actorchats[chatscreen][data[i].id1+'_'+data[i].id2].recived = 0;
            }
            //$scope.actorchats[chatscreen] = data;
          } else {
            if ($scope.userchats[chatscreen] == null) $scope.userchats[chatscreen] = {};
            for (i = 0; i < data.length; i++) {
              $scope.userchats[chatscreen][data[i].id1+'_'+data[i].id2] = data[i];
              $scope.userchats[chatscreen][data[i].id1+'_'+data[i].id2].recived = 0;
            }
            //$scope.userchats[chatscreen] = data;
          }
        } else if (category == 1) {
          if ($scope.groupchats[chatscreen] == null) $scope.groupchats[chatscreen] = {};
          for (i = 0; i < data.length; i++) {
            $scope.groupchats[chatscreen][data[i].id1+'_'+data[i].id2] = data[i];
            $scope.groupchats[chatscreen][data[i].id1+'_'+data[i].id2].recived = 0;
          }
          //$scope.groupchats[chatscreen] = data;
        } else if (category == 2) {
          if ($scope.actorchats[chatscreen] == null) $scope.actorchats[chatscreen] = {};
          for (i = 0; i < data.length; i++) {
            $scope.actorchats[chatscreen][data[i].id1+'_'+data[i].id2] = data[i];
            $scope.actorchats[chatscreen][data[i].id1+'_'+data[i].id2].recived = 0;
          }
          //$scope.actorchats[chatscreen] = data;
        }
        $scope.messages[chatscreen] = null;
        $scope.current_chatroom[chatscreen] = null;
        $('a[href="#actors-'+chatscreen+'"]').tab('show');
      } else {
        //Load groups in structures
        if (category == 1) {
            $scope.groups = data;
        }
      }
    });
    //Recive default chats index
    socket.on('chat:load_defaults_index', function(chats, schema){
      $scope.chat_defaults_index = chats;
      $scope.chat_defaults_schema = schema;
    });
    //Update default chat position
    socket.on('chat:update_defaults_position', function(id, position){
      $scope.chat_defaults_index[id].position = +position;
    });
    //Load chatroom
    socket.on('message:loadchatroom', function(data, chatscreen) {
      $scope.messages[chatscreen] = data;
    });
    //Recive message
    socket.on('message:new', function(message) {
      //Messages Stack
      $scope.messages_stack.push(message);
      if ($scope.messages_stack.length > 5)
        $scope.messages_stack.shift();
      //Load in chatrooms
      angular.forEach($scope.current_chatroom, function(chatroom, key){
        if (chatroom != null) {
          if ((message.chat_id1==chatroom.id1) && (message.chat_id2==chatroom.id2)) {
            $scope.messages[key].push(message);
          }
        }
        if($scope.actorchats[key] && $scope.actorchats[key][message.chat_id1+'_'+message.chat_id2]) {
          if ($scope.current_chatroom[key] == null || $scope.current_chatroom[key].id1 != message.chat_id1 || $scope.current_chatroom[key].id2 != message.chat_id2) {
            $scope.actorchats[key][message.chat_id1+'_'+message.chat_id2].recived += 1;
          }
          $scope.actorchats[key][message.chat_id1+'_'+message.chat_id2].created = new Date().toString();
        }
        if($scope.userchats[key] && $scope.userchats[key][message.chat_id1+'_'+message.chat_id2]) {
          if ($scope.current_chatroom[key] == null || $scope.current_chatroom[key].id1 != message.chat_id1 || $scope.current_chatroom[key].id2 != message.chat_id2) {
            $scope.userchats[key][message.chat_id1+'_'+message.chat_id2].recived += 1;
          }
          $scope.userchats[key][message.chat_id1+'_'+message.chat_id2].created = new Date().toString();
        }
        if($scope.groupchats[key] && $scope.groupchats[key][message.chat_id1+'_'+message.chat_id2]) {
          if ($scope.current_chatroom[key] == null || $scope.current_chatroom[key].id1 != message.chat_id1 || $scope.current_chatroom[key].id2 != message.chat_id2) {
            $scope.groupchats[key][message.chat_id1+'_'+message.chat_id2].recived += 1;
          }
          $scope.groupchats[key][message.chat_id1+'_'+message.chat_id2].created = new Date().toString();
        }
      });
    });
    //Check if it's necessary reload current chatroom
    socket.on('message:check_reload', function(chat) {
      angular.forEach($scope.current_chatroom, function(chatroom, key){
        if (chatroom != null) {
          if ((chat.id1==chatroom.id1) && (chat.id2==chatroom.id2)) {
            socket.emit('message:loadchatroom', {id1: chat.id1, id2: chat.id2, chatscreen: key});
          }
        }
      });
      if ((chat.id1==$scope.current_chatroom[chatscreen].id1) && (chat.id2==$scope.current_chatroom[chatscreen].id2)) {
        socket.emit('message:loadchatroom', {id1: chat.id1, id2: chat.id2, chatscreen: chatscreen});
      }
    });
    //Recive new participation petition
    socket.on('petition:new', function(petition){
      $scope.petitions.push(petition);
    });

    //FUNCTIONS
    //USER FUNCTIONS
    this.addUser = function(role){
      var newuser = {
        username: $scope.newusername,
        role: role,
        status: $scope.newuserstatus
      };
      $scope.newusername = '';
      $scope.newuserstatus = '';
      $scope.actors.push(newuser);
      socket.emit('user:new', newuser);
    };
    this.loadUser = function(user, chatscreen) {
      $scope.actorchats[chatscreen] = null;
      $scope.userchats[chatscreen] = null;
      $scope.groupchats[chatscreen] = null;
      if(($scope.current_user[chatscreen]) && ($scope.current_user[chatscreen].username == user.username)) {
        //Clean chatscreen
        $scope.current_user[chatscreen] = null;
      } else {
        //Load user in chatscreen
        $scope.current_user[chatscreen] = user;
        socket.emit('chat:load_by_category', {category: 1, chatscreen: chatscreen});
        socket.emit('chat:load_by_category', {category: 0, id: user.username, chatscreen: chatscreen, role: user.role});
        if (user.role == 1) socket.emit('chat:load_by_category', {category: 2, id: user.username, chatscreen: chatscreen});
        $('a[href="#'+chatscreen+'"]').tab('show');
      }
    }
    this.bulkUpdate = function(){
      for(var k in $scope.users) {
        var userstatus = parseInt($scope.users[k].status);
        if (userstatus != 2 && userstatus != 3) {
          //L'Usuari no està bloquejat o està en Bypass
          $scope.users[k].status = $scope.bulk_status;
          socket.emit('user:update', $scope.users[k]);
        }
      }
      socket.emit('user:update_default_status', $scope.bulk_status);
      $scope.petitions = [];
    }

    //CHAT FUNCTIONS
    this.addGroup = function(role){
      var newchat = {
        id1: $scope.newgroupname,
        id2: 'GROUP',
        category: 1,
        role: role,
        status: $scope.newgroupstatus
      };
      $scope.newgroupname = '';
      $scope.newgroupstatus = '';
      $scope.groups.push(newchat);
      socket.emit('chat:new', newchat);
    };
    this.changeGroupStatus = function(group){
      socket.emit('chat:update', group);
    };
    this.changeUserStatus = function(user){
      socket.emit('user:update', user);
    };
    this.selectChatroom = function(id1, id2, chatscreen, status){
      $scope.current_chatroom[chatscreen] = {id1: id1, id2: id2, status: status};
      socket.emit('message:loadchatroom', {id1: id1, id2: id2, chatscreen: chatscreen});
      if($scope.actorchats[chatscreen] && $scope.actorchats[chatscreen][id1+'_'+id2]) $scope.actorchats[chatscreen][id1+'_'+id2].recived = 0;
      if($scope.userchats[chatscreen] && $scope.userchats[chatscreen][id1+'_'+id2]) $scope.userchats[chatscreen][id1+'_'+id2].recived = 0;
      if($scope.groupchats[chatscreen] && $scope.groupchats[chatscreen][id1+'_'+id2]) $scope.groupchats[chatscreen][id1+'_'+id2].recived = 0;
    };
    this.resetChatroom = function(chatscreen) {
      $scope.current_chatroom[chatscreen] = null;
      $scope.messages[chatscreen] = null;
    }
    this.loadChat = function(id) {
      var position = $scope.chat_defaults_index[id].total;
      socket.emit('message:load_default_chat', {position : position , id : id });
    }
    this.increaseChat = function(id) {
      var position = $scope.chat_defaults_index[id].position
      socket.emit('message:increase_default_chat', {position : position , id : id });
    }
    this.goToChat = function(id) {
      var position = $scope.chat_defaults_index[id].goto;
      if (position > $scope.chat_defaults_index[id].total) {
        alert('La posició seleccionada sobrepassa el límit')
      } else {
        socket.emit('message:load_default_chat', {position : position , id : id });
      }
      $scope.chat_defaults_index[id].goto = null;
    }
    this.sendToBeamer = function(id1, id2, chatscreen){
      if (($scope.beamerchats[chatscreen]) && (($scope.beamerchats[chatscreen].id1 == id1) && ($scope.beamerchats[chatscreen].id2 == id2))) {
        //Clean chatroom
        socket.emit('message:sendtobeamer', {id1: null, id2: null, chatscreen: chatscreen});
        $scope.beamerchats[chatscreen] = null;
      } else {
        //Load chat
        socket.emit('message:sendtobeamer', {id1: id1, id2: id2, chatscreen: chatscreen});
        $scope.beamerchats[chatscreen] = {id1: id1, id2: id2};
      }
    }
    this.viewChat = function(author, id1, id2, chatscreen){
      //Load author in current_user
      if ($scope.actors[author]) this.loadUser($scope.actors[author], chatscreen);
      if ($scope.users[author]) this.loadUser($scope.users[author], chatscreen);
      var controller = this;
      $('.modal-background').toggle();
      setTimeout(function () {
          if ($scope.actorchats[chatscreen] && $scope.actorchats[chatscreen][id1+'_'+id2]) {
            controller.selectChatroom(id1, id2, chatscreen, $scope.actorchats[chatscreen][id1+'_'+id2].status);
          }
          if ($scope.userchats[chatscreen] && $scope.userchats[chatscreen][id1+'_'+id2]) {
            controller.selectChatroom(id1, id2, chatscreen, $scope.userchats[chatscreen][id1+'_'+id2].status);
          }
          if ($scope.groupchats[chatscreen] && $scope.groupchats[chatscreen][id1+'_'+id2]) {
            controller.selectChatroom(id1, id2, chatscreen, $scope.groupchats[chatscreen][id1+'_'+id2].status);
          }
          $('.modal-background').toggle();
      }, 1000, controller);
    }

    //MESSAGE FUNCTIONS
    this.sendMessage = function(chatscreen){
      var newmessage = {
        created: new Date(),
        author: $scope.current_user[chatscreen].username,
        chat_id1: $scope.current_chatroom[chatscreen].id1,
        chat_id2: $scope.current_chatroom[chatscreen].id2,
        text: emojiClean($('.text-input#'+chatscreen).html())
      };
      $scope.messages[chatscreen].push(newmessage);
      $('.text-input#'+chatscreen).text('');
      socket.emit('message:new', newmessage);
    };
    this.defaultMessage = function(username, pos) {
      socket.emit('message:senddefault', {username: username, pos:pos});
      this.sendToBeamer('Lina', username, 'beamer');
    };

    //PARTICIPATION FUNCTIONS
    this.updatePetition = function(petition, index){
      socket.emit('petition:update', petition);
      $scope.petitions.splice(index, 1);
    };
  });
})();
