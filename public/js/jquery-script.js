$(window).load(function(){
  $('.emoji-button').click(function(){
    $('.emoji-selector').toggle();
    resizeMessagePane();
    //$('.message-pane').animate({ scrollTop: $(document).height() }, "slow");
  });

  $('.text-input').click(function(){
    $('.emoji-selector').hide();
    resizeMessagePane();
  });

  $('.text-input').resize(function(){
    if ($('.chat-pane').is(':visible')) {
      resizeMessagePane();
    }
  });

  $('.emoji-injector').click(function(){
    $('.text-input').html($('.text-input').html() + twemoji.parse($(this).children('img').attr('alt'),
      {
        base: '/libs/twemoji/',
        size: 'svg',
        ext: '.svg',
      }));
  });

  function resizeMessagePane(){
    var val = 100;
    var pageURL = $(location).attr("href");
    if (pageURL.indexOf("admin") != -1) {
      val = val + 150;
    }
    val =  val + $('.text-input').height();
    if ($('.emoji-selector').is(':visible')) {
      val = val + 220;
    }
    $('.message-pane').css('height', 'calc(100vh - '+val+'px )');
    $('.message-pane').css('height', '-moz-calc(100vh - '+val+'px )');
  }
});
