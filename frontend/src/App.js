import './index.css';
import React, {useEffect, useRef, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "./Navigation/StickyBar";
import NeighborsCarousel from "./Carousel/Carousel";
import ReactLoading from "react-loading";
import Typography from "@mui/material/Typography";
import { TfiAngleDown, TfiAngleUp } from "react-icons/tfi";


async function fetchAvailableDatasets(host) {
    let url = host + '/api/collection-names';

    return await fetch(url, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Dataset names could not be retrieved. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        }).catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}

function extractHost() {
    // Get host
    let in_host = window.location.href;
    // Remove trailing slash if present
    if (in_host.endsWith('/')) {
        in_host = in_host.substring(0, in_host.length - 1);
    }
    // Remove port from host. Keep http:// or https:// and the domain name, e.g. http://localhost
    // Get index of second colon
    let colon_count = 0;
    let i = 0;
    while (colon_count < 2 && i < in_host.length) {
        if (in_host[i] === ':') {
            colon_count++;
        }
        i++;
    }
    // If the last character is not a colon, add it to the host
    if (i === in_host.length) {
        in_host += ':';
        i++;
    }
    return in_host.substring(0, i) + '80';
}

function App() {
    const [dimensionsStage, setDimensionsStage] = useState({
        width: document.documentElement.clientWidth - 63,
        height: document.documentElement.clientHeight - 64
    });
    // Define host
    let host = extractHost();
    // Define data from text search
    const [searchData, setSearchData] = useState({});
    // Define boolean for showing the carousel with the nearest neighbors of a clicked image
    const [showCarousel, setShowCarousel] = useState(false);
    // Define variable for storing the index of the clicked image
    const [clickedImageIndex, setClickedImageIndex] = useState(-1);
    // Define boolean for first carousel render
    const [firstRender, setFirstRender] = useState(true);
    // Define state for datasets
    const [datasets, setDatasets] = useState([]);
    // Define state for selected dataset
    const [selectedDataset, setSelectedDataset] = useState(null);

    useEffect(() => {
        // Define function for updating the dimensions of the stage
        const updateDimensions = () => {
            setDimensionsStage({
                width: document.documentElement.clientWidth - 63,
                height: document.documentElement.clientHeight - 64
            });
        };
        // Add event listener
        document.documentElement.addEventListener('resize', updateDimensions);

        const await_datasets = async () => {
            await fetchAvailableDatasets(host)
                .then(data => {
                    setDatasets(data.collections);
                    setSelectedDataset(data.collections[0]);
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        }

        await_datasets();

        // Return cleanup function for removing the event listener
        return () => {
            document.documentElement.removeEventListener('resize', updateDimensions);
        };
    }, []);

    const invertShownCarousel = () => {
        if (firstRender) {
            setFirstRender(false);
        }
        setShowCarousel(!showCarousel);
    }

    return (
        selectedDataset !== null ?
            <div className="main">
                <StickyBar host={host}
                           setSearchData={setSearchData}
                           setShowCarousel={setShowCarousel}
                           datasets={datasets}
                           setSelectedDataset={setSelectedDataset}
                />
                <div className="top-0 bg-black flex flex-col items-center justify-center m-8">
                    <Stage width={dimensionsStage.width}
                           height={dimensionsStage.height}
                           raf={true}
                           renderOnComponentChange={false}
                           options={{backgroundColor: 0x000000}}>
                        <ClustersMap width={dimensionsStage.width}
                                     height={dimensionsStage.height}
                                     host={host}
                                     selectedDataset={selectedDataset}
                                     searchData={searchData}
                                     setShowCarousel={setShowCarousel}
                                     setClickedImageIndex={setClickedImageIndex}/>
                    </Stage>
                    <div id="gesture-area" style={
                        {
                            position: 'absolute',
                            top: "32px",
                            left: "32px",
                            width: dimensionsStage.width,
                            height: dimensionsStage.height,
                            pointerEvents: 'none'
                        }
                    }/>
                        <div id="carousel" className={`w-full bg-black carousel-container flex flex-col items-center justify-center ${showCarousel ? 'h-carousel' : 'h-0'}
                        ${!firstRender ? 'height-transition' : ''}`}>
                            <button className={`mb-1 ${showCarousel ? 'h-1/10' : 'h-full'}`} onClick={() => invertShownCarousel()}>
                                {showCarousel ? <TfiAngleDown style={{ zIndex: 1000 }} className="text-white"/> :
                                <TfiAngleUp style={{ zIndex: 1000 }} className="text-white"/>}
                            </button>
                            <div className={`carousel-div ${showCarousel ? 'h-9/10' : 'h-0'} 
                            ${!firstRender ? 'height-transition' : ''}`}>
                                {clickedImageIndex !== -1 && <NeighborsCarousel host={host} clickedImageIndex={clickedImageIndex}/>}
                            </div>
                        </div>

                </div>
            </div>
            :
            <div className="bg-black flex flex-col items-center justify-center w-screen h-screen">
                <ReactLoading type="spinningBubbles" color="#ffffff" height={100} width={100}/>
                <Typography variant="h1" sx={{
                    backgroundColor: 'black',
                    fontSize: 'calc(min(3vh, 3vw))',
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    fontFamily: 'Roboto Slab, serif',
                    textAlign: 'center',
                    color: 'white',
                    marginTop: '2%'
                }}>
                    Painting...
                </Typography>
            </div>
    );
}


export default App;
