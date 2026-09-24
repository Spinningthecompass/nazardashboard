# -*- coding: utf-8 -*-
"""
Bundle the dashboard source tree into one self-contained HTML file.

    python3 build.py            # run from the dashboard folder
    python3 build.py SRC_DIR    # or point at it

Writes SRC_DIR/dist/dashboard.html: every stylesheet, script, data file and
image inlined, each image exactly once. That file is what gets published as an
artifact and what the tests run against. index.html itself opens straight from
disk (double-click) — the data files are plain <script>s, so no server needed.
"""
import base64, mimetypes, os, re, sys


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def bundle(src):
    read = lambda rel: open(os.path.join(src, rel), encoding='utf-8').read()
    html = read('index.html')

    def css_repl(m):
        rel = m.group(1)
        css = read(rel)
        css_dir = os.path.dirname(os.path.join(src, rel))
        css = re.sub(r"url\('([^')]+)'\)",
                     lambda u: "url('" + (u.group(1) if u.group(1).startswith('data:')
                                          else data_uri(os.path.normpath(os.path.join(css_dir, u.group(1))))) + "')", css)
        return '<style>/* ' + rel + ' */\n' + css + '</style>'

    def js_repl(m):
        rel = m.group(1)
        js = read(rel)
        if rel == 'js/core/icons.js':
            js = re.sub(r"'(assets/img/[^']+)'", lambda u: "'" + data_uri(os.path.join(src, u.group(1))) + "'", js)
        return '<script>/* ' + rel + ' */\n' + js.replace('</script', '<\\/script') + '</script>'

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_repl, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js_repl, html)
    out = os.path.join(src, 'dist', 'dashboard.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    return out


if __name__ == '__main__':
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__)))
    out = bundle(src)
    print('built ->', out, '(%.2f MB)' % (os.path.getsize(out) / 1e6))
