// Component for showing the nearest neighbors of an image on click or on search.

import React, {useEffect, useRef, useState} from 'react';
import Carousel from 'react-multi-carousel';
import CarouselImageCard from "./CarouselImageCard";
import 'react-multi-carousel/lib/styles.css';
import {getUrlForImage} from "../utilities";
import './carousel.css';
import MainImageCard from "./MainImageCard";


const responsive = {
    desktop: {
        breakpoint: {
            max: 3000,
            min: 1024
        },
        items: 3
    },
    mobile: {
        breakpoint: {
            max: 464,
            min: 0
        },
        items: 2
    },
    tablet: {
        breakpoint: {
            max: 1024,
            min: 464
        },
        items: 3
    }
};

const generateText = (image) => {
    const author = image.author.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    let text = ["Author: " + author + "."];
    if (image.title !== undefined) {
        // Capitalize first letter of each word
        const title = image.title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        text.push("Title: " + title + ".");
    }
    if (image.genre !== undefined) {
        text.push("Genre: " + image.genre + ".");
    }
    if (image.date !== undefined) {
        if (image.date !== -1) {
            text.push("Date: " + image.date + ".");
        }
    }
    return text;
}

function fetchNeighbors(index, k, host, dataset) {
    // The function takes in an index of an image, and fetches the nearest neighbors of the image from the server.
    // Then it populates the state images with the fetched images.
    const url = `${host}/api/neighbors?index=${index}&k=${k}&collection=${dataset}`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Neighbors could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}


function fetchCaption(images, i, host, dataset) {
    // The function takes in a list of images, and fetches the captions of the images from the server.
    // Then it populates the state images with the fetched images.
    const url = `${host}/api/caption?index=${images[i].index}&collection=${dataset}`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Caption could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}


const NeighborsCarousel = (props) => {
    // Define state for images to show. The state consists of pairs (path, text), where path is the path to the image
    // and text is the text associated to the image.
    const [images, setImages] = useState([]);
    const [captions, setCaptions] = useState([]);
    const [image, setImage] = useState(null);
    const selectedDataset = useRef(props.selectedDataset);


    useEffect(() => {
        // Initialize captions to "Generating captions..."
        let captions = [];
        for (let i = 0; i < 10; i++) {
            captions.push("Generating captions...");
        }
        setCaptions(captions);

        // Fetch neighbors from server
        fetchNeighbors(props.clickedImageIndex, 10, props.host, selectedDataset.current)
            .then(data => {
                // Populate state images with the fetched images
                let images = [];
                let first = true;
                for (const image of data) {
                    // noinspection JSUnresolvedVariable
                    const new_image = {
                        path: image.path,
                        index: image.index,
                        author: image.author,
                        width: image.width
                    }
                    // noinspection JSUnresolvedVariable
                    if (image.genre !== undefined) {
                        // noinspection JSUnresolvedVariable
                        new_image.genre = image.genre;
                    }
                    // noinspection JSUnresolvedVariable
                    if (image.title !== undefined) {
                        // noinspection JSUnresolvedVariable
                        new_image.title = image.title;
                    }
                    // noinspection JSUnresolvedVariable
                    if (image.date !== undefined) {
                        // noinspection JSUnresolvedVariable
                        new_image.date = image.date;
                    }
                    // noinspection JSUnresolvedVariable
                    images.push(
                        new_image
                    );
                    if (first) {
                        // noinspection JSUnresolvedVariable
                        setImage(new_image);
                        first = false;
                    }
                }
                setImages(images);
                return images
            })
            .then(images => {
                // Fetch captions from server
                /*
                for (let i = 0; i < images.length; i++) {
                    fetchCaption(images, i, props.host, props.selectedDataset)
                        .then(data => {
                            // Replace the corresponding caption with the fetched caption
                            setCaptions(prevCaptions => {
                                let newCaptions = [...prevCaptions];
                                newCaptions[i] = data.caption + ".\n" + images[i].author;
                                return newCaptions;
                            });
                        });
                } */
            });
    }, [props.clickedImageIndex]);

    useEffect(() => {
        selectedDataset.current = props.selectedDataset;
        setImage(null);
        setImages([]);
    }, [props.selectedDataset]);

    return (
        <>
            {/* Place space for the main image of the carousel */}
            {image &&
                <div className="h-image flex flex-row justify-center items-center pointer-events-auto margin-between-images-bottom">
                    <MainImageCard placeholderSrc={getUrlForImage(image.path, selectedDataset.current, props.host)}
                                   src={`${props.host}/${selectedDataset.current}/${image.path}`}
                                   width={`${image.width}px`}
                                   maxWidth="90%"
                                   cursor="pointer"
                                   objectFit="fit"
                                   text={generateText(image)}/>
                </div>

            }
            <div className="w-full h-carousel flex flex-row justify-center items-center">
                <Carousel
                    additionalTransfrom={0}
                    arrows
                    autoPlaySpeed={3000}
                    centerMode={false}
                    className="carousel"
                    containerClass="container"
                    dotListClass=""
                    draggable={false}
                    focusOnSelect={false}
                    infinite={false}
                    itemClass=""
                    keyBoardControl
                    minimumTouchDrag={80}
                    pauseOnHover
                    renderArrowsWhenDisabled={false}
                    renderButtonGroupOutside={false}
                    renderDotsOutside={false}
                    responsive={responsive}
                    rewind={false}
                    rewindWithAnimation={false}
                    rtl={false}
                    shouldResetAutoplay
                    showDots={false}
                    sliderClass=""
                    slidesToSlide={1}
                >
                    {images.map((image, index) => {
                        return <CarouselImageCard
                            key={index}
                            url={getUrlForImage(image.path, selectedDataset.current, props.host)}
                            setImage={setImage}
                            image={image}/>
                    })}
                </Carousel>
            </div>
        </>

    );
}

export default NeighborsCarousel;
