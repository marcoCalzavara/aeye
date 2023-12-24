import './index.css';
import React, {useEffect, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "./Navigation/StickyBar";
import NeighborsCarousel from "./Carousel/Carousel";


function App() {
    const [dimensionsStage, setDimensionsStage] = useState({
        width: document.documentElement.clientWidth - 63,
        height: document.documentElement.clientHeight - 64
    });
    const [showBar, setShowBar] = useState(false);
    // Define data from text search
    const [searchData, setSearchData] = useState({});
    // Define boolean for showing the carousel with the nearest neighbors of a clicked image
    const [showCarousel, setShowCarousel] = useState(false);
    // Define variable for storing the index of the clicked image
    const [clickedImageIndex, setClickedImageIndex] = useState(-1);

    useEffect(() => {
        const updateDimensions = () => {
            setDimensionsStage({
                width: document.documentElement.clientWidth - 63,
                height: document.documentElement.clientHeight - 64
            });
        };

        // Add event listener
        document.documentElement.addEventListener('resize', updateDimensions);

        // Return cleanup function
        return () => {
            document.documentElement.removeEventListener('resize', updateDimensions);
        };
    }, []);

    return (
        <div className="main">
            <StickyBar setSearchData={setSearchData}/>
            <div className="bg-black flex flex-col items-center justify-center pb-8 pt-8 pr-8 pl-8">
                <Stage width={dimensionsStage.width}
                       height={dimensionsStage.height}
                       raf={true}
                       renderOnComponentChange={false}
                       options={{backgroundColor: 0x000000}}>
                    <ClustersMap width={dimensionsStage.width} height={dimensionsStage.height}
                                 host="http://localhost:80" searchData={searchData}
                                 setShowCarousel={setShowCarousel}
                                 setClickedImageIndex={setClickedImageIndex}/>
                </Stage>
                {showCarousel && <NeighborsCarousel host="http://localhost:80" clickedImageIndex={clickedImageIndex}/>}
            </div>
        </div>
    );
}


export default App;
