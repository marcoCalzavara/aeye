import React, {useEffect, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "./Navigation/StickyBar";
import SearchBar from "./Navigation/SearchBar";

function App() {
    const [dimensionsStage, setDimensionsStage] = useState({
        width: window.innerWidth * 0.7,
        height: (window.innerWidth * 0.7 * 23) / 32
    });

    useEffect(() => {
        const handleResizeStage = () => {
            setDimensionsStage({
                width: window.innerWidth * 0.7,
                height: (window.innerWidth * 0.7 * 23) / 32
            });
        };

        // Add event listener
        window.addEventListener('resize', handleResizeStage);

        // Return cleanup function
        return () => {
            window.removeEventListener('resize', handleResizeStage);
        };
    }, []);

    return (
        <div id="main">
            <StickyBar/>
            <div className="bg-zinc-900 flex flex-col items-center 2xl:mt-16 xl:mt-14 md:mt-14 sm:mt-12 xs:mt-12">
                <SearchBar host="http://localhost:80"/>
                <Stage width={dimensionsStage.width}
                       height={dimensionsStage.height}
                       raf={true}
                       renderOnComponentChange={false}
                       options={{backgroundColor: 0x000000}}>
                    <ClustersMap width={dimensionsStage.width} height={dimensionsStage.height}
                                 host="http://localhost:80"/>
                </Stage>
            </div>
        </div>
    );
}


export default App;
