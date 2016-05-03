(function(){
  var app = angular.module('1000likes', ['ngCookies', 'luegg.directives', 'sc.twemoji', 'ngSanitize', 'ngRoute']);

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
    var socket = io.connect('', {query:"device=app"});
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

  app.controller('AppController', function($scope, socket, $cookieStore, $route, $routeParams, $location){
    //Define glued setting
    $scope.glued = true;

    //Define chatscreen
    var chatscreen = "app";

    //Define arrays
    $scope.current_user = {app: null};
    $scope.userchats = {app: null};
    $scope.actorchats = {app: null};
    $scope.groupchats = {app: null};
    $scope.current_chatroom = {app: null};
    $scope.messages = {app: null};
    $scope.petition = {message: null, status: null};

    //Get username if it's defined or define and store it
    if ($location.search().username){
      //Username in the URL /#/?username=alias
      //TODO: Securize it!!!
      socket.emit('user:load', $location.search().username);
    } else {
      var username = $cookieStore.get('username');
      if (!username) {
        username = newUsername();
        socket.emit('user:new', {username : username, role : 0, status: 0});
      } else {
        socket.emit('user:load', username);
      }
    }

    //Load chatrooms
    socket.emit('chat:load_by_category', {category: 1, chatscreen: chatscreen});

    //SOCKET LISTENERS
    //Recive chatroom messages
    socket.on('message:loadchatroom', function(data, chatscreen) {
      $scope.messages[chatscreen] = data;
    });
    //Recive message
    socket.on('message:new', function(message) {
      var date = new Date();
      date = date.toString();
      if ($scope.current_chatroom[chatscreen] != null) {
        if ((message.chat_id1==$scope.current_chatroom[chatscreen].id1) && (message.chat_id2==$scope.current_chatroom[chatscreen].id2)) {
          $scope.messages[chatscreen].push(message);
        }
      }
      if($scope.actorchats[chatscreen] && $scope.actorchats[chatscreen][message.chat_id1+'_'+message.chat_id2]) {
        if ($scope.current_chatroom[chatscreen] == null || $scope.current_chatroom[chatscreen].id1 != message.chat_id1 || $scope.current_chatroom[chatscreen].id2 != message.chat_id2) {
          $scope.actorchats[chatscreen][message.chat_id1+'_'+message.chat_id2].recived += 1;
        }
        $scope.actorchats[chatscreen][message.chat_id1+'_'+message.chat_id2].created = date;
      }
      if($scope.userchats[chatscreen] && $scope.userchats[chatscreen][message.chat_id1+'_'+message.chat_id2]) {
        if ($scope.current_chatroom[chatscreen] == null || $scope.current_chatroom[chatscreen].id1 != message.chat_id1 || $scope.current_chatroom[chatscreen].id2 != message.chat_id2) {
          $scope.userchats[chatscreen][message.chat_id1+'_'+message.chat_id2].recived += 1;
        }
        $scope.userchats[chatscreen][message.chat_id1+'_'+message.chat_id2].created = date;
      }
      if($scope.groupchats[chatscreen] && $scope.groupchats[chatscreen][message.chat_id1+'_'+message.chat_id2]) {
        if ($scope.current_chatroom[chatscreen] == null || $scope.current_chatroom[chatscreen].id1 != message.chat_id1 || $scope.current_chatroom[chatscreen].id2 != message.chat_id2) {
          $scope.groupchats[chatscreen][message.chat_id1+'_'+message.chat_id2].recived += 1;
        }
        $scope.groupchats[chatscreen][message.chat_id1+'_'+message.chat_id2].created = date;
      }
    });
    //Check if it's necessary reload current chatroom
    socket.on('message:check_reload', function(chat) {
      if ((chat.id1==$scope.current_chatroom[chatscreen].id1) && (chat.id2==$scope.current_chatroom[chatscreen].id2)) {
        socket.emit('message:loadchatroom', {id1: chat.id1, id2: chat.id2, chatscreen: chatscreen});
      }
    });
    //New user created
    socket.on('user:new', function(user) {
      $scope.current_user[chatscreen] = user;
      $cookieStore.put('username', user.username);
      socket.emit('chat:load_by_category', {category: 0, id: user.username, chatscreen: chatscreen, role: user.role});
      $('#wellcomeModal').modal('show');
    });
    //Recive current user
    socket.on('user:load', function(user) {
      if(user) {
        $scope.current_user[chatscreen] = user;
        socket.emit('chat:load_by_category', {category: 0, id: user.username, chatscreen: chatscreen, role: user.role});
        //If it's an actor, load chats with other actorchats
        if (user.role == 1) socket.emit('chat:load_by_category', {category: 2, id: user.username, chatscreen: chatscreen, role: user.role});
        switch (user.status) {
          case 0:
            $('#wellcomeModal').modal('show');
            break;
          case 2:
            $('#userBlocked').modal({
              'show' : true,
              'backdrop' : 'static',
              'keyboard' : false
            });
            break;
          default:
        }
      } else {
        username = newUsername();
        socket.emit('user:new', {username : username, role : 0, status: 0});
      }
    });
    //Recive user update
    socket.on('user:update', function(user){
      //Update own user status
      var status = parseInt(user.status);
      $scope.current_user[chatscreen].status = status;
      $('.modal').modal('hide');
      $scope.current_chatroom[chatscreen] = null;
      switch (status) {
        case 0:
          $scope.petition = null;
          $('#userNormal').modal('show');
          break;
        case 1:
          $('#userParticipation').modal('show');
          break;
        case 2:
          $('#userBlocked').modal({
            'show' : true,
            'backdrop' : 'static',
            'keyboard' : false
          });
          break;
        default:
      }
      /* En principino s'actualitzen els actors
      if (user.role == 1) {
        //Actor updated
        //TODO: Update all actorchats maybe isn't the best solution
        socket.emit('chat:load_by_category', {category: 0, id: $scope.current_user[chatscreen].username, chatscreen: chatscreen});
        //Check current chat
        if ($scope.current_chatroom[chatscreen].id1 == user.username) {
          $scope.current_chatroom[chatscreen] = null;
          $('#groupClosedModal').modal('show');
        }
      }
      */
    });
    //Recive chats
    socket.on('chat:load_by_category', function(data, category, chatscreen) {
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
    });
    //Recive new chat
    socket.on('chat:new', function(data) {
      //Only actors recive new chats
      if ($scope.userchats[chatscreen]) {
        $scope.userchats[chatscreen].push(data);
      } else {
        $scope.userchats[chatscreen] = [data]
      }
    });
    //Recive chat update
    socket.on('chat:update', function(data) {
      if (data.id2 == 'GROUP') {
        //TODO: Update all groupchats maybe isn't the best solution
        socket.emit('chat:load_by_category', {category: 1, chatscreen: chatscreen});
        // Check current chatroom
        if ($scope.current_chatroom[chatscreen] != null) {
          if (($scope.current_chatroom[chatscreen].id1 == data.id1) && ($scope.current_chatroom[chatscreen].id2 == data.id2)) {
            if (data.status == 1) {
              //Current chartoom closed
              $scope.current_chatroom[chatscreen] = null;
              $('#groupClosedModal').modal('show');
            } else {
              //Current chatroom become accessible or open
              $scope.current_chatroom[chatscreen] = data;
              if (data.status == 2) {
                $('#groupAccessibleModal').modal('show');
              } else {
                $('#groupOpenModal').modal('show');
              }
            }
          }
        }
      }
    });
    //Recive petition response
    socket.on('petition:response', function(status) {
      $('.modal').modal('hide');
      switch (status) {
        case 1:
          $scope.current_user[chatscreen].status =  3;
          $scope.petition.status = parseInt(status);
          $('#userBypass').modal('show');
          break;
        case 2:
          $scope.petition = null;
          $('#userNoBypass').modal('show');
          break;
        default:
      }
    });

    //FUNCTIONS
    this.sendMessage = function(chatscreen){
      var id1 = $scope.current_chatroom[chatscreen].id1;
      var id2 = $scope.current_chatroom[chatscreen].id2;
      var newmessage = {
        created: new Date(),
        author: $scope.current_user[chatscreen].username,
        chat_id1: id1,
        chat_id2: id2,
        text: emojiClean($('.text-input').html())
        //text: $('#text-input').text()
      };
      $scope.messages[chatscreen].push(newmessage);
      $('.text-input').text('');
      socket.emit('message:new', newmessage);
      if($scope.actorchats[chatscreen] && $scope.actorchats[chatscreen][id1+'_'+id2]) $scope.actorchats[chatscreen][id1+'_'+id2].created = new Date().toString();
      if($scope.userchats[chatscreen] && $scope.userchats[chatscreen][id1+'_'+id2]) $scope.userchats[chatscreen][id1+'_'+id2].created = new Date().toString();
      if($scope.groupchats[chatscreen] && $scope.groupchats[chatscreen][id1+'_'+id2]) $scope.groupchats[chatscreen][id1+'_'+id2].created = new Date().toString();
    };
    this.selectChatroom = function(id1, id2, chatscreen, status){
      $scope.current_chatroom[chatscreen] = {id1: id1, id2: id2, status:status};
      socket.emit('message:loadchatroom', {id1: id1, id2: id2, chatscreen: chatscreen});
      if($scope.actorchats[chatscreen] && $scope.actorchats[chatscreen][id1+'_'+id2]) $scope.actorchats[chatscreen][id1+'_'+id2].recived = 0;
      if($scope.userchats[chatscreen] && $scope.userchats[chatscreen][id1+'_'+id2]) $scope.userchats[chatscreen][id1+'_'+id2].recived = 0;
      if($scope.groupchats[chatscreen] && $scope.groupchats[chatscreen][id1+'_'+id2]) $scope.groupchats[chatscreen][id1+'_'+id2].recived = 0;
    };
    this.resetChatroom = function(chatscreen) {
      $scope.current_chatroom[chatscreen] = null;
      $('.text-input').text('');
    };
    this.toggleParticipation = function() {
      $('#participationForm').modal('show');
    };
    this.sendPetition = function(chatscreen) {
      $scope.petition.status = 0;
      $scope.petition.username = $scope.current_user[chatscreen].username;
      socket.emit('petition:send', $scope.petition);
    }
  });
})();
