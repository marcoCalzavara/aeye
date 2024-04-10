import * as React from 'react';


export default function TextArea({text, width, height, fontsize, line_height, marginBottom}) {
    const textRef = React.useRef(null);
    const [margin, setMargin] = React.useState(0);

    React.useEffect(() => {
        if (textRef.current) {
            if (textRef.current.scrollHeight > textRef.current.clientHeight) {
                setMargin(6);
            } else {
                setMargin(0);
            }
        }
    }, [text]);

    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderRadius: '10px',
                maxHeight: height,
                marginBottom: marginBottom + 'px',
                width: width + 'px',
                pointerEvents: "auto",
                backgroundColor: "rgb(49 49 52 / 1)"
            }
        }>
            <div ref={textRef} style=
                {
                    {
                        pointerEvents: "auto",
                        backgroundColor: "transparent",
                        fontFamily: 'Roboto Slab, serif',
                        fontSize: fontsize + 'px',
                        lineHeight: line_height,
                        hyphens: "auto",
                        textAlign: "justify",
                        hyphenateLimitChars: "2 1 1",
                        whiteSpace: "pre-wrap",
                        paddingRight: margin + 'px',
                        width: width + 'px',
                        overflow: "auto",
                        height: 'auto',
                    }
                }>
                {text}
            </div>
        </div>
    );
}