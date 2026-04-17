(() => {
  // <stdin>
  jQuery(function() {
    function toTop() {
      var $toTop = $(".gotop");
      $(window).on("scroll", function() {
        if ($(window).scrollTop() >= $(window).height()) {
          $toTop.css("display", "block").fadeIn();
        } else {
          $toTop.fadeOut();
        }
      });
      $toTop.on("click", function(evt) {
        var $obj = $("body,html");
        $obj.animate({ scrollTop: 0 }, 240);
        evt.preventDefault();
      });
    }
    toTop();
  });
})();
//# sourceMappingURL=main.js.map
