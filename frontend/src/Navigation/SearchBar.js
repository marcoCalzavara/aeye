import React, {useRef, useState} from "react";
import SearchIcon from '@mui/icons-material/Search';
import {IconButton, InputBase} from "@mui/material";

export default function SearchBar(props) {
    const [inputValue, setInputValue] = useState("");
    const [open, setOpen] = useState(false);
    const host = useRef(props.host);

    const sendText = async (text) => {
        let url = host.current + '/api/image-text?collection=' + props.selectedDataset + '&text=' + text + '&page=1';
        const result = await fetch(url, {
            method: 'GET'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Data could not be retrieved. Status: ' + response.status + ' ' + response.statusText);
                }
                return response.json();
            })
            .then(firstGet => {
                url = host.current + '/api/image-to-tile?index=' + firstGet.index + '&collection=' + props.selectedDataset + "_image_to_tile";

                return fetch(url, {
                    method: 'GET'
                })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Data could not be retrieved. Status: ' + response.status + ' ' + response.statusText);
                        }
                        return response.json();
                    })
                    .then(secondGet => {
                        return {
                            firstGet: firstGet,
                            secondGet: secondGet
                        };
                    });
            }).catch(error => {
                // Handle any errors that occur during the fetch operation
                console.error('Error:', error);
            });

        // Group result into object with fields tile and image. Tile is an array of three elements, while image contains
        // the global position of the image, and its width and height.
        let groupedResult = {};
        // noinspection JSUnresolvedVariable
        groupedResult.tile = result.secondGet.zoom_plus_tile;
        groupedResult.image = {};
        // noinspection JSUnresolvedVariable
        groupedResult.image.x = result.firstGet.low_dimensional_embedding_x;
        // noinspection JSUnresolvedVariable
        groupedResult.image.y = result.firstGet.low_dimensional_embedding_y;
        groupedResult.image.width = result.firstGet.width;
        groupedResult.image.height = result.firstGet.height;
        groupedResult.image.index = result.firstGet.index;

        // Set result in parent component
        props.setShowCarousel(false);
        props.setSearchData(groupedResult);
    };

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    const handleEnter = (event) => {
        if (event.key === 'Enter') {
            handleClickSearch(event);
        }
    }

    const handleClickSearch = () => {
        setOpen(false);
        // noinspection JSIgnoredPromiseFromCall
        sendText(inputValue);
        setInputValue("");
    };

    const handleClick = () => {
        setOpen(!open);
    }

    return (
        <div className="w-searchbar h-searchbar flex justify-between items-center z-10 bg-white rounded-full searchBar">
            <InputBase
                className="w-98 h-full pl-3 font-bar"
                label={"Search Images by Text"}
                placeholder={"\"A painting of a dog\""}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleEnter}
                onClick={handleClick}
            />
            <IconButton type="button" onClick={handleClickSearch}>
                <SearchIcon/>
            </IconButton>
        </div>
    );
}