import requests
from bs4 import BeautifulSoup
import re
import time

url = "https://www.logosapostolic.org/bibles/textus_receptus/"
bookURLs = [
    "matthew/mat",
    "mark/mark",
    "luke/luke",
    "john/john",
    "acts/acts",
    "romans/rom",
    "1_corinthians/fcor",
    "2_corinthians/scor",
    "galatians/gal",
    "ephesians/eph",
    "philippians/phps",
    "colossians/col",
    "1_thessalonians/fthes",
    "2_thessalonians/sthes",
    "1_timothy/ftim",
    "2_timothy/stim",
    "titus/titus",
    "philemon/phmn",
    "hebrews/heb",
    "james/jam",
    "1_peter/fpet",
    "2_peter/spet",
    "1_john/fjohn",
    "2_john/sjohn",
    "3_john/tjohn",
    "jude/jude",
    "revelation/rev"
]

# Book names for better output
book_names = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", 
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", 
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", 
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", 
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", 
    "Jude", "Revelation"
]


def getVersesFromChapter(bookURL, book_name, chapter_num):
    """Get verses as both a list and dictionary"""
    numString = str(chapter_num).zfill(2)  # Pad with zero
    thisChapterURL = url + bookURL + numString + ".htm"
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(thisChapterURL, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the Greek paragraph
        greek_p = soup.find('p', class_='grc', lang='grc')
        if not greek_p:
            print(f"No Greek text found for {thisChapterURL}")
            return [], {}
        
        # Get all the HTML and split by <br> tags
        html_content = str(greek_p)
        
        # Split by <br> tags (with or without closing slash)
        segments = re.split(r'<br\s*/?>', html_content)
        
        verses_list = []
        verse_dict = {}
        
        for segment in segments:
            # Skip empty segments
            if not segment.strip():
                continue
                
            # Parse this segment
            segment_soup = BeautifulSoup(segment, 'html.parser')
            
            # Find the verse number in <strong> tags
            strong_tags = segment_soup.find_all('strong')
            if not strong_tags:
                continue
                
            # Get verse reference from the strong tag
            verse_ref = strong_tags[0].get_text(strip=True)
            
            # Remove all strong tags to get just the Greek text
            for strong in strong_tags:
                strong.decompose()
            
            # Get the remaining Greek text
            greek_text = segment_soup.get_text(strip=True)
            
            # Clean up the verse reference (remove book name, keep just X:Y)
            clean_ref = re.search(r'(\d+:\d+)', verse_ref)
            if clean_ref:
                clean_ref = clean_ref.group(1)
            else:
                clean_ref = verse_ref
            
            # Only add if we have both reference and text
            if clean_ref and greek_text:
                verses_list.append(clean_ref)
                verse_dict[clean_ref] = greek_text
        
        object = {
            "verseList": verses_list,
            "verseDict": verse_dict
        }

        print("Finished " + book_name + " chapter " + str(chapter_num))
        #print("Hello!")
        return object
        
    except Exception as e:
        print(f"Error: {e}")
        return {}

def scrape_book(book_index, max_chapters=50):
    """Scrape all chapters for a specific book"""
    bookURL = bookURLs[book_index]
    book_name = book_names[book_index]
    
    print(f"Scraping {book_name}...")
    
    book_text = []
    chapter = 1
    while chapter <= max_chapters:
        textObject = getVersesFromChapter(bookURL, book_name, chapter)
        
        if "verseList" in textObject:
            chapterVerses = textObject["verseList"]
            chapterText = textObject["verseDict"]

            for verseAddress in chapterVerses:
                text = verseAddress.replace(":", ".") + " " + chapterText[verseAddress].strip()
                book_text.append(text)
    
        # Be polite to the server
            chapter += 1
            time.sleep(1)
        else:
            chapter = 500
    
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