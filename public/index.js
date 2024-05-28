// TODO: This is bad. Don't use it.

function wordToElement(word, count=0) {
    const it = document.createElement('div')

    const wordEl = document.createElement('span')
    wordEl.innerText = word
    it.appendChild(wordEl)

    const countEl = document.createElement('span')
    countEl.innerText = count
    it.appendChild(countEl)

    const buttonEl = document.createElement('button')
    buttonEl.innerText = '+'
    buttonEl.addEventListener("click", ev => {
        let count = +(countEl.innerText)
        count++
        countEl.innerText = count

        // PUT = update existing record. search term: "HTTP verbs"
        // Not thinking about error handling here because this is a dummy frontend, but real things should have good error handling
        fetch(`/words/${word}/increment`, {method: 'PUT'}).then(res => res.text()).then(res => console.log(res)).catch(err => console.log(err))
    })
    it.appendChild(buttonEl)

    return it
}

function launchApp(el, el2) {
    el.innerText = "Loading words..."

    fetch("/words").then(res => res.json()).then(res => {
        el.innerText = ""
        for (let item of res) {
            el.appendChild(wordToElement(item.word, item.total_count))
        }

        const newWordDiv = document.createElement('div')
        const newWordButton = document.createElement('button')
        newWordDiv.appendChild(newWordButton)
        newWordButton.innerText = "Add word"
        newWordButton.addEventListener("click", ev => {
            const word = prompt("New word?")
            if (word.length === 0) return

            fetch(`/words/${word}`, {method: 'POST'}).then(res => res.text()).then(res => {
                el.appendChild(wordToElement(word, 0))
                console.log(res)
            }).catch(err => console.error(err))
        })

        el2.appendChild(newWordButton)
    }).catch(err => console.error(err))
}