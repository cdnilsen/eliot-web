word = "----kootumukqus"

word2 = "anamaqutum---"

def killTrailingDashes(word):
	
    while word.startswith("-"):
        word = word[1:]
      
    while word.endswith("-"):
        word = word[0:-1]
    
    print(word)
    
killTrailingDashes(word)
killTrailingDashes(word2)