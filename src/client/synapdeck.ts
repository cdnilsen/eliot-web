import {transliterateGeez} from './transcribe_geez.ts';

let inputBox = document.getElementById('userInput') as HTMLInputElement;
let outputDiv = document.getElementById("output") as HTMLDivElement;

if (inputBox) {
    inputBox.addEventListener('input', (event) => {
        let target = inputBox.value;
        outputDiv.innerHTML = transliterateGeez(target);
    });
}