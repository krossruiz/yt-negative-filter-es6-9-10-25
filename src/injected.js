// injected.js
console.log("REVISED")

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      // Don't traverse DOM elements, just describe them
      if (value instanceof Element) {
          let desc = value.tagName;
          if (value.id) desc += `#${value.id}`;
          if (value.className && typeof value.className === 'string') {
              desc += `.${value.className.split(' ').join('.')}`;
          }
          return `[Element: ${desc}]`;
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  };

function eventToObject(ev) {
    const plainObject = {};
    for (const key in ev) {
        if (typeof ev[key] !== 'function') {
            plainObject[key] = ev[key];
        }
    }
    // Ensure important properties are included, even if non-enumerable
    const importantProps = [
        'type', 'bubbles', 'cancelable', 'composed', 'isTrusted', 'timeStamp', 'detail',
        'target', 'currentTarget', 'eventPhase', 'defaultPrevented', 'returnValue', 'srcElement'
    ];
    for (const prop of importantProps) {
        if (ev[prop] !== undefined) {
            plainObject[prop] = ev[prop];
        }
    }
    return plainObject;
}

const orig = EventTarget.prototype.dispatchEvent;

// /* Events you DON'T want to spam the console with */
 const skip = [
     'mousemove', 'pointermove', 'pointerover', 'pointerout',
     'mouseover', 'mouseout', 'scroll'
 ];

 const seen = new Set();

 let eventLog = "";

 EventTarget.prototype.dispatchEvent = function (ev) {
     const { type } = ev;

     if (!skip.includes(type)) {
         if (!seen.has(type)) {
             //console.log('%c[NEW EVENT TYPE]', 'color:#0af', type);
             eventLog += `[NEW EVENT TYPE] ${type}\n`;
             seen.add(type);
         }
         //console.log('%c[' + type + ']', 'color:#888', this, ev);
         let targetDescription = this.tagName || '[no-tag]';
         if (this.id) {
            targetDescription += `#${this.id}`;
         }
         if (this.className && typeof this.className === 'string') {
            targetDescription += `.${this.className.replace(/\s+/g, '.')}`;
         }

         let eventString;
         try {
            eventString = JSON.stringify(eventToObject(ev), getCircularReplacer(), 2);
         } catch (e) {
            eventString = `Could not stringify event object: ${e.message}`;
         }

         eventLog += `[${type}] on ${targetDescription}\nEvent: ${eventString}\n\n`;
     }
     return orig.call(this, ev);
};

console.log('%c🔎 Custom-event logger ACTIVE (auto)', 'color:#fa0');

async function saveEventLog() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);

    let hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // Handle midnight (0)

    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    // Filename-safe date/time string. Example: 6-28-25-9-56-05pm
    const dateTime = `${month}-${day}-${year}-${hours}-${minutes}-${seconds}${ampm}`;
    const filename = `YTNegFil-eventLog-${dateTime}.txt`;

    const blob = new Blob([eventLog], { type: 'text/plain;charset=utf-8' });

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Text Documents',
                accept: {
                    'text/plain': ['.txt'],
                },
            }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log(`Event log saved to the location you selected.`);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('User cancelled the save dialog.');
        } else {
            console.error('Could not use showSaveFilePicker, falling back to direct download.', err);
            // Fallback to the old method
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`Event log saved via fallback method as ${filename}`);
        }
    }
}

// Expose the function to be called from the console, e.g., for debugging
window.saveEventLog = saveEventLog;
console.log('To save the event log, call saveEventLog() from the console.');

window.addEventListener('message', (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) {
        return;
    }

    if (event.data.type && (event.data.type === 'FROM_CONTENT_SCRIPT_SAVE_LOG')) {
        saveEventLog();
    }
}, false);
