/* Home page for the application */

import '../index.css';
import React, {useEffect, useRef, useState} from 'react';
import ClustersMap from "../Map/ClustersMap";
import {Stage} from "@pixi/react";
import StickyBar from "../Navigation/StickyBar"
import NeighborsCarousel from "../Carousel/Carousel";
import ReactLoading from "react-loading";
import Typography from "@mui/material/Typography";
import {TfiAngleDown, TfiAngleUp} from "react-icons/tfi";
import {
    getResponsiveHeight,
    getResponsiveMargin,
    getButtonSize,
    getCarouselContainerMarginTop,
    getCarouselContainerMarginBottom,

} from "../utilities";
// import HamburgerMenu from "../Navigation/HamburgerMenu";


function fetchAvailableDatasets(host) {
    let url = host + '/api/collection-names';

    return fetch(url, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Dataset names could not be retrieved. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Fetch dataset info for each dataset
            let fetchPromises = data.collections.map(collection => {
                let url = host + '/api/collection-info?collection=' + collection;
                return fetch(url, {
                    method: 'GET'
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Dataset info could not be retrieved. Status: ' + response.status + ' ' + response.statusText);
                        }
                        return response.json();
                    })
                    .then(info => {
                        return {collection, zoom_levels: info.zoom_levels};
                    });
            });

            return Promise.all(fetchPromises)
                .then(results => {
                    let datasets_info = new Map();
                    results.forEach(result => {
                        datasets_info.set(result.collection, result.zoom_levels);
                    });
                    return {
                        collections: data.collections,
                        collections_info: datasets_info
                    };
                })
                .catch(error => {
                    // Handle any errors that occur during the fetch operation
                    console.error('Error:', error);
                });
        })
        .catch(error => {
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

const Home = (props) => {
    const [dimensionsStage, setDimensionsStage] = useState({
        width: document.documentElement.clientWidth - 2 * getResponsiveMargin().replace('px', ''),
        height: document.documentElement.clientHeight - getResponsiveHeight().replace('px', '')
            - getCarouselContainerMarginTop().replace('px', '') - getCarouselContainerMarginBottom().replace('px', '')
            - getButtonSize().replace('px', '')
    });
    // Define host
    let host = useRef(extractHost());
    // Define data from text search
    const [searchData, setSearchData] = useState({});
    // Define boolean for showing the carousel with the nearest neighbors of a clicked image
    const [showCarousel, setShowCarousel] = useState(false);
    // Define variable for storing the index of the clicked image
    const [clickedImageIndex, setClickedImageIndex] = useState(-1);
    const prevClickedImageIndex = useRef(-1);
    // Define state for datasets
    const [datasets, setDatasets] = useState([]);
    // Define state for selected dataset
    const [selectedDataset, setSelectedDataset] = useState(null);
    // Define state for dataset info
    const [datasetInfo, setDatasetInfo] = useState(null);
    // Define state to know if initial loading is done
    const [initialLoadingDone, setInitialLoadingDone] = useState(false);

    useEffect(() => {
        // Define function for updating the dimensions of the stage
        const updateDimensions = () => {
            setDimensionsStage({
                width: document.documentElement.clientWidth - 2 * getResponsiveMargin(),
                height: document.documentElement.clientHeight - getResponsiveHeight().replace('px', '')
                    - getCarouselContainerMarginTop().replace('px', '') - getCarouselContainerMarginBottom().replace('px', '')
                    - getButtonSize().replace('px', '')
            });
        };
        // Add event listener
        document.documentElement.addEventListener('resize', updateDimensions);

        // Fetch available datasets
        fetchAvailableDatasets(host.current)
            /**
             * @param data {object} - Response from the server
             * @param data.collections {array} - Array of available datasets
             */
            .then(data => {
                setDatasets(data.collections);
                setSelectedDataset(data.collections[0]);
                setDatasetInfo(data.collections_info);

            })
            .catch(error => {
                console.error('Error:', error);
            });

        // Return cleanup function for removing the event listener
        return () => {
            document.documentElement.removeEventListener('resize', updateDimensions);
        };
    }, []);


    const invertShownCarousel = () => {
        if (clickedImageIndex !== -1) {
            setShowCarousel(!showCarousel);
            prevClickedImageIndex.current = clickedImageIndex;
        }
    }

    useEffect(() => {
        // Restore initial state for everything related to the carousel
        setClickedImageIndex(-1);
        setShowCarousel(false);
    }, [selectedDataset]);

    return (
        <>
            {(selectedDataset !== null && datasetInfo.get(selectedDataset) !== undefined) &&
                <div className="home" hidden={props.page !== "home" || !initialLoadingDone}>
                    <StickyBar host={host.current}
                               hasSearchBar={true}
                               setSearchData={setSearchData}
                               setShowCarousel={setShowCarousel}
                               datasets={datasets}
                               selectedDataset={selectedDataset}
                               setSelectedDataset={setSelectedDataset}
                               page={props.page}
                               setPage={props.setPage}
                               searchBarIsClicked={props.searchBarIsClicked}
                    />
                    {/*<HamburgerMenu*/}
                    {/*    menuOpen={menuOpen}*/}
                    {/*    setMenuOpen={setMenuOpen}*/}
                    {/*    datasets={datasets}*/}
                    {/*    setSelectedDataset={setSelectedDataset}*/}
                    {/*    setPage={props.setPage}*/}
                    {/*/>*/}
                    <div className="bg-black flex flex-col items-center justify-center mt-sticky m-canvas-side mainContentOpacity">
                        <Stage width={dimensionsStage.width}
                               height={dimensionsStage.height}
                               raf={true}
                               renderOnComponentChange={false}
                               options={{backgroundColor: 0x000000}}>
                            <ClustersMap width={dimensionsStage.width}
                                         height={dimensionsStage.height}
                                         host={host.current}
                                         selectedDataset={selectedDataset}
                                         maxZoomLevel={datasetInfo.get(selectedDataset)}
                                         searchData={searchData}
                                         showCarousel={showCarousel}
                                         setShowCarousel={setShowCarousel}
                                         prevClickedImageIndex={prevClickedImageIndex}
                                         clickedImageIndex={clickedImageIndex}
                                         setClickedImageIndex={setClickedImageIndex}
                                         setInitialLoadingDone={setInitialLoadingDone}
                                         searchBarIsClicked={props.searchBarIsClicked}
                            />
                        </Stage>
                        <div id="carousel"
                             className="z-50 w-full bg-transparent carousel-container flex flex-col items-center justify-center"
                             style={
                                 {
                                     marginTop: {showCarousel} ? '0' : getCarouselContainerMarginTop(),
                                     position: 'absolute',
                                     bottom: {showCarousel} ? '0' : '-100%'
                                 }
                             }>
                            {clickedImageIndex !== -1 && (
                                <button
                                    className="z-50 mb-1 flex flex-row items-center justify-center button pointer-events-auto"
                                    /*style={
                                        {
                                            width: "43px",
                                            height: "43px",
                                            borderRadius: "50%",
                                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        }
                                    }*/
                                    onPointerDown={() => {
                                        invertShownCarousel();
                                    }}>
                                    {showCarousel ?
                                        <TfiAngleDown style={{zIndex: 1000, fontWeight: 2000}}
                                                      className="text-white button"/> :
                                        <TfiAngleUp style={{zIndex: 1000}} className="text-white button"/>}
                                </button>
                            )}
                            <div
                                className={`z-50 flex flex-col items-center justify-center bg-transparent carousel-div max-h-carousel-plus-image
                                 height-transition ${showCarousel && clickedImageIndex !== -1 ? 'open' : 'close'}`}>
                                {clickedImageIndex !== -1 &&
                                    <NeighborsCarousel host={host.current} clickedImageIndex={clickedImageIndex}
                                                       selectedDataset={selectedDataset}/>}
                            </div>
                        </div>
                    </div>
                </div>}
            {(selectedDataset === null || datasetInfo.get(selectedDataset) === undefined || !initialLoadingDone) &&
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
                </div>}
        </>
    );
}


export default Home;
