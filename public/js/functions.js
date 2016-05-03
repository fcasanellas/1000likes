/*
* New username
*/
function newUsername() {
  var consonants = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];
  var vocals = ['A', 'E', 'I', 'O', 'U'];
  var c1 = consonants[Math.floor(Math.random() * 20)];
  var c2 = consonants[Math.floor(Math.random() * 20)];
  var v1 = vocals[Math.floor(Math.random() * 5)];
  var v2 = vocals[Math.floor(Math.random() * 5)];
  return c1+v1+c2+v2;
}

/*
 * Clean messages with Emojis
 */
function emojiClean(text) {
  var txt_array = text.split('<img class="emoji" draggable="false" alt="');
  var res_array = [];
  for (index = 0; index < txt_array.length; ++index) {
    var txt = txt_array[index];
    if (txt.indexOf('src="') > -1) {
      var txt_split = txt.split('" src="');
      res_array[res_array.length] = txt_split[0];
      var rest_split = txt_split[1].split('.svg">');
      if (rest_split[1] != ''){
        res_array[res_array.length] = rest_split[1];
      }
    } else {
      res_array[res_array.length] = txt;
    }
  }
  return res_array.join('');
}
