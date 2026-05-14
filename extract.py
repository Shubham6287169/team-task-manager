with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

start_marker = '<script type="text/babel">'
start = html.find(start_marker)
if start != -1:
    end = html.rfind('</script>')
    js_content = html[start + len(start_marker):end].strip()
    
    with open('app.jsx', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    new_html = html[:start] + '<script type="text/babel" src="/app.jsx"></script>\n</body>\n</html>'
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
        
    print("Extracted to app.jsx successfully")
