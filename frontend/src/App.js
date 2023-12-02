import React, {useEffect, useRef, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";

function App() {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({width: 0, height: 0});

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            });
        }
    }, [containerRef.current]);

    return (
        <div className="flex justify-center">
            {/*<StickyBar onImageFetched={updateImage}/>*/}
            <div ref={containerRef} className="w-2/3 h-920px">
                <Stage width={1280}
                       height={920}
                       raf={true}
                       renderOnComponentChange={false}>
                    <ClustersMap width={1280} height={920} host="http://localhost:80"/>
                </Stage>
            </div>
        </div>
    );
}

export default App;
