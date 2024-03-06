import * as React from 'react';
// import {TfiAngleDown, TfiAngleUp} from "react-icons/tfi";


export default function TextArea({text, margin, expanded, setExpanded}) {
    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'start',
                borderRadius: '10px',
                height: "100%",
                width: "100%",
                pointerEvents: "auto",
                overflow: expanded ? "auto" : "hidden",
                backgroundColor: "rgb(49 49 52 / 1)"
            }
        }>
            {/*<button className="bg-transparent text-white" onPointerDown={() => setExpanded(!expanded)}>
                {!expanded ? <TfiAngleDown className="text-white"/> :
                    <TfiAngleUp className="text-white"/>
            </button>*/}
            <div style=
                     {
                        {
                            pointerEvents: "auto",
                            backgroundColor: "transparent",
                            marginLeft: margin,
                            marginRight: margin,
                            marginBottom: margin,
                        }
                    }
                 onPointerDown={() => setExpanded(!expanded)}>
                {text}
            </div>
        </div>
    );
}