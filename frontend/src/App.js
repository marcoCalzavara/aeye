import './index.css';
import React, {useEffect, useRef, useState} from 'react';
import ClustersMap from "./Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "./Navigation/StickyBar";
import NeighborsCarousel from "./Carousel/Carousel";
import ReactLoading from "react-loading";
import Typography from "@mui/material/Typography";
import {TfiAngleDown, TfiAngleUp} from "react-icons/tfi";


const responsive_margins = {
    m_side_320: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-320"),
    m_side_480: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-480"),
    m_side_768: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-768"),
    m_side_1024: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-1024"),
    m_side_1200: getComputedStyle(document.documentElement).getPropertyValue("--m-canvas-side-1200"),
};

const responsive_heights = {
    h_sticky_320: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-320"),
    h_sticky_480: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-480"),
    h_sticky_768: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-768"),
    h_sticky_1024: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-1024"),
    h_sticky_1200: getComputedStyle(document.documentElement).getPropertyValue("--h-sticky-1200"),
}

function getResponsiveMargin() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_margins.m_side_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_margins.m_side_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_margins.m_side_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_margins.m_side_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_margins.m_side_1200;
        default:
            return responsive_margins.m_side_1200;
    }
}

function getResponsiveHeight() {
    switch (true) {
        case document.documentElement.clientWidth >= 320 && document.documentElement.clientWidth <= 480:
            return responsive_heights.h_sticky_320;
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            return responsive_heights.h_sticky_480;
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            return responsive_heights.h_sticky_768;
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            return responsive_heights.h_sticky_1024;
        case document.documentElement.clientWidth > 1200:
            return responsive_heights.h_sticky_1200;
        default:
            return responsive_heights.h_sticky_1200;
    }
}

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
    console.log(responsive_margins)
    console.log(getResponsiveMargin())
    const [dimensionsStage, setDimensionsStage] = useState({
        width: document.documentElement.clientWidth - 2 * getResponsiveMargin().replace('px', ''),
        height: document.documentElement.clientHeight - getResponsiveHeight().replace('px', '')
        - getResponsiveMargin().replace('px', '')
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
    const carouselHeight = useRef(0);

    useEffect(() => {
        // Define function for updating the dimensions of the stage
        const updateDimensions = () => {
            setDimensionsStage({
                width: document.documentElement.clientWidth - 2 * getResponsiveMargin(),
                height: document.documentElement.clientHeight - getResponsiveHeight().replace('px', '')
                - getResponsiveMargin().replace('px', '')
            });
        };
        // Add event listener
        document.documentElement.addEventListener('resize', updateDimensions);

        fetchAvailableDatasets(host)
            .then(data => {
                setDatasets(data.collections);
                setSelectedDataset(data.collections[0]);
            })
            .catch(error => {
                console.error('Error:', error);
            });


        // Return cleanup function for removing the event listener
        return () => {
            document.documentElement.removeEventListener('resize', updateDimensions);
        };
    }, []);

    useEffect(() => {
        console.log("Hey")
        const carouselDiv = document.getElementById('carousel');
        if (carouselDiv) {
            const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.contentRect.height > carouselHeight.current) {
                        console.log(carouselHeight.current, entry.contentRect.height);
                        window.scroll({
                            top: document.body.scrollHeight,
                            left: 0,
                            behavior: 'smooth'
                        });
                    }
                    carouselHeight.current = entry.contentRect.height;
                }
            });
            observer.observe(carouselDiv);

            // Return cleanup function for disconnecting the observer
            return () => {
                observer.disconnect();
            };
        }
    }, [selectedDataset]); // We want to set the observer only when the selected dataset changes, so we avoid multiple
    // observers being created


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
                <div className="bg-black flex flex-col items-center justify-center mt-sticky m-canvas-side">
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
                    <div id="carousel"
                         className={`w-full bg-black carousel-container flex flex-col items-center justify-center ${showCarousel && clickedImageIndex !== -1 ? 'h-carousel' : 'h-0'}
                        ${!firstRender ? 'height-transition' : ''}`}>
                        <button className={`mb-1 ${showCarousel ? 'h-1/10' : 'h-full'}`}
                                onClick={() => invertShownCarousel()}>
                            {showCarousel ? <TfiAngleDown style={{zIndex: 1000}} className="text-white"/> :
                                <TfiAngleUp style={{zIndex: 1000}} className="text-white"/>}
                        </button>
                        <div className={`carousel-div ${showCarousel ? 'h-9/10' : 'h-0'} 
                            ${!firstRender ? 'height-transition' : ''}`}>
                            {clickedImageIndex !== -1 &&
                                <NeighborsCarousel host={host} clickedImageIndex={clickedImageIndex}/>}
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
