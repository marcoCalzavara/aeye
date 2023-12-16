import React, {useRef, useState} from "react";
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import {InputBase} from "@mui/material";
import {DATASET} from "../Map/Cache";

export default function SearchBar(props) {
    const [searchHistory, setSearchHistory] = useState([]);
    const [shownSearchHistory, setShownSearchHistory] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [anchorEl, setAnchorEl] = useState(null);
    const [open, setOpen] = useState(false);
    const host = useRef(props.host);
    const setSearchData = props.setSearchData;
    const max_state_length = 20;
    const max_history_shown = 5;

    const updateSearchHistory = () => {
        let updatedSearchHistory = []
        if (!searchHistory.includes(inputValue))
            updatedSearchHistory = [inputValue, ...searchHistory];
        else
            updatedSearchHistory = searchHistory;

        if (updatedSearchHistory.length > max_state_length) {
            updatedSearchHistory = updatedSearchHistory.slice(0, max_state_length);
        }
        setSearchHistory(updatedSearchHistory);
    };

    const sendText = async (text) => {
        console.log("Sending text: " + text);

        let url = host.current + '/api/image-text?collection=' + DATASET + '&text=' + text + '&page=1';

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
                url = host.current + '/api/image-to-tile?index=' + firstGet.index + '&collection=' + DATASET + "_image_to_tile";

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
        groupedResult.tile = result.secondGet.zoom_plus_tile;
        groupedResult.image = {};
        groupedResult.image.x = result.firstGet.low_dimensional_embedding_x;
        groupedResult.image.y = result.firstGet.low_dimensional_embedding_y;
        groupedResult.image.width = result.firstGet.width;
        groupedResult.image.height = result.firstGet.height;
        groupedResult.image.index = result.firstGet.index;

        // Set result in parent component
        setSearchData(groupedResult);
    };

    const handleInputChange = (event) => {
        let search = event.target.value;
        let newShownSearchHistory = [];
        for (let str of searchHistory) {
            if (!(search === "") && str.toLowerCase().startsWith(search.toLowerCase())) {
                newShownSearchHistory.push(str);
            }
            if (newShownSearchHistory.length === max_history_shown)
                break;
        }

        setShownSearchHistory(newShownSearchHistory);
        setInputValue(search);
    };

    const handleEnter = (event) => {
        if (event.key === 'Enter') {
            handleClickSearch(event);
        }
    }

    const handleMouseLeave = (event) => {
        setShownSearchHistory([]);
        setOpen(false);
    }

    const handleClickSearch = (event) => {
        updateSearchHistory();
        setShownSearchHistory([]);
        setOpen(false);
        // noinspection JSIgnoredPromiseFromCall
        sendText(inputValue);
        setInputValue("");
    };

    const handleClickHistory = (text) => {
        setInputValue(text);
    }

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
        setOpen(!open);
    }

    return (
        <div className="h-search w-full flex flex-col justify-evenly items-center flex-none bg-zinc-900">
            <b className="text-white text-4xl">AiPlusArt</b>
            <div className="w-searchbar h-searchbar flex justify-between items-center z-10 bg-white rounded-full">
                <InputBase
                    className="w-98 h-full pl-3"
                    label={"Search Images by Text"}
                    placeholder={"\"A painting of a dog\""}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleEnter}
                    onClick={handleClick}
                    style={{fontSize: '15px'}}
                />
                <IconButton type="button" onClick={handleClickSearch}>
                    <SearchIcon/>
                </IconButton>
            </div>
        </div>
    );
}