import * as React from 'react';


function computeTextWithEllipsis(text, width, fontSize, lines) {
    // Compute width of each character given the font size
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = fontSize + 'px Roboto Slab, serif';
    // Continue to add characters until the width of the text is greater than the width of the text area
    const availableWidth = width * lines - ctx.measureText(' ...').width - ctx.measureText('-').width;
    let currentWidth = 0;
    for (let i = 0; i < text.length; i++) {
        if (currentWidth + ctx.measureText(text[i]).width > availableWidth) {
            // Go back to previous empty space and add ellipsis
             let j = i - 1;
            while (j >= 0 && text[j] !== ' ') {
                j--;
            }
            if (j === -1) {
                return '...';
            }
            return text.slice(0, j) + ' ...';
        }
        else {
            currentWidth += ctx.measureText(text[i]).width;
        }
    }
    return text;
}


export default function TextArea({text, margin, width, fontsize, lines, line_height, expanded, setExpanded}) {
    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'start',
                borderRadius: '10px',
                height: "100%",
                width: width + 'px',
                pointerEvents: "auto",
                overflow: expanded ? "auto" : "hidden",
                backgroundColor: "rgb(49 49 52 / 1)"
            }
        }>
            <div style=
                     {
                        {
                            pointerEvents: "auto",
                            backgroundColor: "transparent",
                            marginLeft: margin,
                            marginRight: margin,
                            fontFamily: 'Roboto Slab, serif',
                            fontSize: fontsize + 'px',
                            lineHeight: line_height,
                            hyphens: "auto",
                            textAlign: "justify",
                            hyphenateLimitChars: "2 1 1",
                            wordSpacing: "-0.5px",
                        }
                    }
                 onPointerDown={(event) => {
                     setExpanded(!expanded);
                     event.stopPropagation();
                 }}>
                {
                    expanded ? text : computeTextWithEllipsis(text, width - 2 * margin, fontsize, lines)
                }
            </div>
        </div>
    );
}