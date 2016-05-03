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
    var socket = io.connect('', {query:"device=beamer"});
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

  app.controller('BeamerController', function($scope, socket, $cookieStore, $route, $routeParams, $location){
    //Define glued setting
    $scope.glued = true;

    //Define arrays
    $scope.current_chatroom = {beamer: null, beamer2: null};
    $scope.current_user = {beamer: null, beamer2: null};
    $scope.messages = {beamer: null, beamer2: null};

    //SOCKET LISTENERS
    //Recive chatroom messages
    socket.on('message:loadchatroom', function(messages, chatscreen, data) {
      $scope.messages[chatscreen] = messages;
      if (data.id1 && data.id2) {
        $scope.current_chatroom[chatscreen] = {"id1": data.id1, "id2": data.id2};
        $scope.current_user[chatscreen] = {"username": data.id1};
      } else {
         //Clean chatroom
         $scope.current_chatroom[chatscreen] = null;
         $scope.current_user[chatscreen] = null;
      }
    });
    //Recive message
    socket.on('message:new', function(message) {
      if ($scope.current_chatroom['beamer']) {
        if ((message.chat_id1==$scope.current_chatroom['beamer'].id1) && (message.chat_id2==$scope.current_chatroom['beamer'].id2)) {
          $scope.messages['beamer'].push(message);
        }
      }
      if ($scope.current_chatroom['beamer2']) {
        if ((message.chat_id1==$scope.current_chatroom['beamer2'].id1) && (message.chat_id2==$scope.current_chatroom['beamer2'].id2)) {
          $scope.messages['beamer2'].push(message);
        }
      }
    });
    //Check if it's necessary reload current chatroom
    socket.on('message:check_reload', function(chat) {
      if ($scope.current_chatroom['beamer']) {
        if ((chat.id1==$scope.current_chatroom['beamer'].id1) && (chat.id2==$scope.current_chatroom['beamer'].id2)) {
          socket.emit('message:loadchatroom', {id1: chat.id1, id2: chat.id2, chatscreen: 'beamer'});
        }
      }
      if ($scope.current_chatroom['beamer2']) {
        if ((chat.id1==$scope.current_chatroom['beamer2'].id1) && (chat.id2==$scope.current_chatroom['beamer2'].id2)) {
          socket.emit('message:loadchatroom', {id1: chat.id1, id2: chat.id2, chatscreen: 'beamer2'});
        }
      }
    });
  });
})();
