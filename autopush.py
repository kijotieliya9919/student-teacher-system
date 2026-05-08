import os, subprocess, time, datetime

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_DIR)

LOG_FILE = os.path.join(PROJECT_DIR, 'autopush.log')

def log(msg):
    line = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def has_changes():
    code, out, _ = run('git status --porcelain')
    return bool(out.strip())

def commit_and_push():
    run('git add .')
    code, out, err = run('git commit -m "Auto-update"')
    if code != 0 and 'nothing to commit' not in out and 'nothing to commit' not in err:
        log(f'Commit issue: {out} {err}')
        return False
    code, out, err = run('git pull --rebase origin main')
    if code != 0:
        log(f'Pull failed: {out} {err}')
    code2, out2, err2 = run('git push origin main')
    if code2 == 0:
        log('Changes pushed to GitHub successfully')
    else:
        log(f'Push failed: {out2} {err2}')
    return code2 == 0

log('Auto-push started - watching for file changes every 60s')
while True:
    try:
        if has_changes():
            log('Changes detected, pushing to GitHub...')
            commit_and_push()
        time.sleep(60)
    except Exception as e:
        log(f'Error: {e}')
        time.sleep(60)
