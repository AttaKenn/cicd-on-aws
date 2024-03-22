var aInput = document.getElementById("a");
var bInput = document.getElementById("b");
var operationSelect = document.getElementById("operation");
var calculateButton = document.getElementById("calculate");
var resultInput = document.getElementById("result");
calculateButton.addEventListener("click", function() {
  var operation = operationSelect.options[operationSelect.selectedIndex].value;
  var a = aInput.value;
  var b = bInput.value;
  var xhr = new XMLHttpRequest();
  xhr.open('GET', encodeURI('/' + operation + '?a=' + a + '&b=' + b));
  xhr.onload = function() {
    if (xhr.status === 200) {
      result.innerHTML = xhr.responseText;
    }
    else {
      result.innerHTML = '<span class="error">' + xhr.responseText + '<span>';
     }
  };
  xhr.send();
});
