(function () {
    const allowedTags = new Set([
        'b', 'br', 'refrao', 'prerefrao', 'ponte', 'intro', 'verso',
        'strong', 'em', 'i', 'u', 'p', 'span', 'pre', 'div'
    ]);

    window.cifroSanitizeCifra = function (html) {
        const preserved = String(html || '').replace(/ {2,}/g, match =>
            match.split('').map((_, index) => index === 0 ? ' ' : '&nbsp;').join('')
        );
        const doc = new DOMParser().parseFromString(preserved, 'text/html');
        Array.from(doc.body.querySelectorAll('*')).forEach(node => {
            if (!allowedTags.has(node.nodeName.toLowerCase())) {
                const parent = node.parentNode;
                if (!parent) return;
                while (node.firstChild) parent.insertBefore(node.firstChild, node);
                parent.removeChild(node);
                return;
            }
            Array.from(node.attributes).forEach(attribute => node.removeAttribute(attribute.name));
        });
        return doc.body.innerHTML;
    };
})();
