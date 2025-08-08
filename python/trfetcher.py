import requests
from bs4 import BeautifulSoup
import re
import time

urlHead = "http://textus-receptus.com/wiki/"
urlTail = "_Greek_NT:_Scrivener%27s_Textus_Receptus_%281894%29"

# Book names for better output
book_names = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", 
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", 
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", 
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", 
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", 
    "Jude", "Revelation"
]

def fixPunctuation(verseText):
    punctuation = [",", ";", ".", "·"]

    for char in punctuation:
        verseText = verseText.replace(" " + char, char)
    return verseText.strip()

def getVersesFromChapter(book_name, chapter_num):
    """Get verses as both a list and dictionary"""
    thisChapterURL = urlHead + book_name.replace(" ", "_") + "_" + str(chapter_num) + urlTail
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(thisChapterURL, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all <li> elements that contain Greek text
        # We'll look for <li> tags that contain links to wiki pages with numbers
        all_lis = soup.find_all('li')
        
        verses_list = []
        verse_dict = {}
        
        for li in all_lis:
            # Check if this <li> contains Greek text by looking for wiki links
            wiki_links = li.find_all('a', href=re.compile(r'/wiki/\d+'))
            
            # Skip if no wiki links (probably not a verse)
            if not wiki_links:
                continue
            
            # Get all <a> tags in this <li>
            all_links = li.find_all('a')
            
            if not all_links:
                continue
            
            # First link should be the verse number
            first_link = all_links[0]
            verse_num_text = first_link.get_text(strip=True)
            
            # Check if it looks like a verse number (should be just a number)
            if not verse_num_text.isdigit():
                continue
            
            # Extract all the Greek text by getting text from wiki links
            greek_words = []
            for link in all_links[1:]:  # Skip the first link (verse number)
                href = link.get('href', '')
                if '/wiki/' in href and re.search(r'/wiki/\d+', href):
                    greek_word = link.get_text(strip=True)
                    if greek_word:
                        greek_words.append(greek_word)
            
            # Also get any non-link text (like punctuation)
            # Remove all <a> tags and get remaining text
            li_copy = BeautifulSoup(str(li), 'html.parser')
            for a_tag in li_copy.find_all('a'):
                a_tag.replace_with(' ' + a_tag.get_text() + ' ')
            
            # Get all text and clean it up
            full_text = li_copy.get_text()
            
            # Extract just the Greek part (everything after the verse number)
            # Remove the verse number from the beginning
            greek_text = re.sub(r'^\s*\d+\s*', '', full_text)
            greek_text = ' '.join(greek_text.split())  # Clean up whitespace
            
            if verse_num_text and greek_text:
                address = str(chapter_num) + "." + verse_num_text
                verses_list.append(address)
                verse_dict[address] = fixPunctuation(greek_text)
        '''
        for verse in verses_list:
            print(str(chapter_num) + "." + verse + " " + verse_dict[verse])
        '''
        
        object = {
            "verseList": verses_list,
            "verseDict": verse_dict
        }

        print("Finished " + book_name + " chapter " + str(chapter_num))
        #print("Hello!")
        return object
        
    except Exception as e:
        print(f"Error: {e}")
        return {
            "verseList": [],
            "verseDict": {}
        }

def scrape_book(book_index, max_chapters=50):
    """Scrape all chapters for a specific book"""
    book_name = book_names[book_index]
    
    print(f"Scraping {book_name}...")
    
    book_text = []
    chapter = 1
    while chapter <= max_chapters:
        textObject = getVersesFromChapter(book_name, chapter)
        if len(textObject["verseList"]) == 0:
            print(" ")
            chapter = 500
        
        if "verseList" in textObject:
            chapterVerses = textObject["verseList"]
            chapterText = textObject["verseDict"]

            for verseAddress in chapterVerses:
                text = verseAddress.replace(":", ".") + " " + chapterText[verseAddress].strip()
                book_text.append(text)
    
        # Be polite to the server
            chapter += 1
            time.sleep(1)
        
    
    return book_text

def writeBookToFile(i):
    text = scrape_book(i)
    file = open("./NT_text/" + book_names[i] + ".Grebrew.txt", "w", encoding="utf-8")
    for line in text:
        file.write(line + "\n")
    file.close()

def main():
    for i in range(len(book_names)):
        writeBookToFile(i)

main()

# 1 Peter 5 has to be done manually, also there are some spurious brackets, etc.
