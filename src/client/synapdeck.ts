import {transliterateGeez} from './transcribe_geez.js';

let inputBox = document.getElementById('userInput') as HTMLInputElement;
let outputDiv = document.getElementById("output") as HTMLDivElement;

if (inputBox) {
    inputBox.addEventListener('input', function() {
        let target = inputBox.value;
        outputDiv.innerHTML = transliterateGeez(target);
    });
}