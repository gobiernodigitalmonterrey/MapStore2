import React, {useState, useEffect, useRef} from 'react';
import Message from '../../../../components/I18N/Message';

import { getCredentials as getStoredCredentials, setCredentials as setStoredCredentials } from '../../../../utils/SecurityUtils';
import { CYCLOMEDIA_CREDENTIALS_REFERENCE } from '../../constants';
import { Alert, Button } from 'react-bootstrap';

import CyclomediaCredentials from './Credentials';
import EmptyStreetView from '../EmptyStreetView';

/**
 * Parses the error message to show to the user in the alert an user friendly message
 * @private
 * @param {object|string} error the error to parse
 * @returns {string|JSX.Element} the error message
 */
const getErrorMessage = (error) => {
    if (error?.indexOf?.("init::Loading user info failed with status code 401") >= 0) {
        return <Message msgId="streetView.cyclomedia.invalidCredentials" />;
    }
    return error?.message ?? "Unknown error";
};

/**
 * EmptyView component. It shows a message when the API is not initialized or the map point are not visible.
 * @private
 * @param {object} props the component props
 * @param {object} props.style the style of the component
 * @param {boolean} props.initializing true if the API is initializing
 * @param {boolean} props.initialized true if the API is initialized
 * @param {object} props.StreetSmartApi the StreetSmartApi object
 * @param {boolean} props.mapPointVisible true if the map point are visible at the current level of zoom.
 * @returns {JSX.Element} the component rendering
 */
const EmptyView = ({initializing, initialized, StreetSmartApi, mapPointVisible}) => {
    if (initialized && !mapPointVisible) {
        return (
            <EmptyStreetView description={<Message msgId="streetView.cyclomedia.zoomIn" />} />
        );
    }
    if (initialized) {
        return (
            <EmptyStreetView />
        );
    }
    if (initializing) {
        return (
            <EmptyStreetView loading description={<Message msgId="streetView.cyclomedia.initializing" />} />

        );
    }
    if (!StreetSmartApi) {
        return (
            <EmptyStreetView loading description={<Message msgId="streetView.cyclomedia.loadingAPI" />} />
        );
    }
    return null;
};

/**
 * CyclomediaView component. It uses the Cyclomedia API to show the street view.
 * API Documentation at https://streetsmart.cyclomedia.com/api/v23.14/documentation/
 * This component is a wrapper of the Cyclomedia API. It uses an iframe to load the API, because actually the API uses and initializes react-dnd,
 * that must be unique in the application and it is already created and initialized by MapStore.
 * @param {object} props the component props
 * @param {string} props.apiKey the Cyclomedia API key
 * @param {object} props.style the style of the component
 * @param {object} props.location the location of the street view. It contains the latLng and the properties of the feature
 * @param {object} props.location.latLng the latLng of the street view. It contains the lat and lng properties
 * @param {object} props.location.properties the properties of the feature. It contains the `imageId` that can be used as query
 * @param {function} props.setPov the function to call when the point of view changes. It receives the new point of view as parameter (an object with `heading` and `pitch` properties)
 * @param {function} props.setLocation the function to call when the location changes. It receives the new location as parameter (an object with `latLng` and `properties` properties)
 * @param {boolean} props.mapPointVisible true if the map point are visible at the current level of zoom. It is used to show a message to zoom in when the map point are not visible.
 * @param {object} props.providerSettings the settings of the provider. It contains the `StreetSmartApiURL` property that is the URL of the Cyclomedia API
 * @returns {JSX.Element} the component rendering
 */

const CyclomediaView = ({ apiKey, style, location = {}, setPov = () => {}, setLocation = () => {}, mapPointVisible, providerSettings = {}}) => {
    const StreetSmartApiURL = providerSettings?.StreetSmartApiURL ?? "https://streetsmart.cyclomedia.com/api/v23.7/StreetSmartApi.js";
    const initOptions = providerSettings?.initOptions ?? {};
    // location contains the latLng and the properties of the feature
    // properties contains the `imageId` that can be used as query
    const {properties} = location;
    const {imageId} = properties ?? {};

    // variables to store the API and the target element for the API
    const [StreetSmartApi, setStreetSmartApi] = useState();
    const [targetElement, setTargetElement] = useState();
    const viewer = useRef(null); // reference for the iframe that will contain the viewer

    // variables to store the state of the API
    const [initializing, setInitializing] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [reload, setReload] = useState(1);
    const [error, setError] = useState(null);

    // gets the credentials from the storage
    const initialCredentials = getStoredCredentials(CYCLOMEDIA_CREDENTIALS_REFERENCE);
    const [credentials, setCredentials] = useState(initialCredentials);
    const {username, password} = credentials ?? {};

    /**
     * Utility function to open an image in street smart viewer (it must be called after the API is initialized)
     * @param {string} query query for StreetSmartApi.open
     * @param {string} srs SRS for StreetSmartApi.open
     * @returns {Promise} a promise that resolves with the panoramaViewer
     */
    const openImage = (query, srs) => {
        const viewerType = StreetSmartApi.ViewerType.PANORAMA;
        const options = {
            viewerType: viewerType,
            srs,
            panoramaViewer: {
                closable: false,
                maximizable: true,
                replace: true,
                recordingsVisible: true,
                navbarVisible: true,
                timeTravelVisible: true,
                measureTypeButtonVisible: true,
                measureTypeButtonStart: true,
                measureTypeButtonToggle: true
            }
        };
        return StreetSmartApi.open(query, options);
    };

    // initialize API
    useEffect(() => {
        if (!StreetSmartApi || !username || !password || !apiKey) return () => {};
        setInitializing(true);
        StreetSmartApi.init({
            targetElement,
            username,
            password,
            apiKey,
            loginOauth: false,
            srs: 'EPSG:4326',
            locale: 'en-us',
            ...initOptions
        }).then(function() {
            setInitializing(false);
            setInitialized(true);
        }).catch(function(err) {
            setInitializing(false);
            setError(err);
            console.error('Cyclomedia API: init: error: ' + err);
        });
        return () => {
            try {
                StreetSmartApi?.destroy?.({targetElement});
            } catch (e) {
                console.error(e);
            }

        };
    }, [StreetSmartApi, username, password, apiKey, reload]);

    const changeView = (_, {detail} = {}) => {
        const {yaw: heading, pitch} = detail ?? {};
        setPov({heading, pitch});
    };
    const changeRecording = (_, {detail} = {}) => {
        const {recording} = detail ?? {};
        // extract coordinates lat long from `xyz` of `recording` and `imageId` from recording `id` property
        if (recording?.xyz && recording?.id) {
            setLocation({
                latLng: {
                    lat: recording?.xyz?.[1],
                    lng: recording?.xyz?.[0]
                },
                properties: {
                    ...recording,
                    imageId: recording?.id
                }
            });
        }
    };
    // open image when the imageId changes
    useEffect(() => {
        if (!StreetSmartApi || !imageId || !initialized) return () => {};
        let panoramaViewer;
        let viewChangeHandler;
        let recordingClickHandler;
        openImage(imageId, 'EPSG:4326')
            .then((result) => {
                if (result && result[0]) {
                    panoramaViewer = result[0];
                    viewChangeHandler = (...args) => changeView(panoramaViewer, ...args);
                    recordingClickHandler = (...args) => changeRecording(panoramaViewer, ...args);
                    panoramaViewer.on(StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, viewChangeHandler);
                    panoramaViewer.on(StreetSmartApi.Events.panoramaViewer.RECORDING_CLICK, recordingClickHandler);
                }

            })
            .catch((err) => {
                setError(err);
                console.error('Cyclomedia API: open: error: ' + err);
            });
        return () => {
            if (panoramaViewer && viewChangeHandler) {
                panoramaViewer.off(StreetSmartApi.Events.panoramaViewer.VIEW_CHANGE, viewChangeHandler);
                panoramaViewer.off(StreetSmartApi.Events.panoramaViewer.RECORDING_CLICK, recordingClickHandler);
            }
        };
    }, [StreetSmartApi, initialized, imageId]);

    // handle view state
    const hasCredentials = username && password;
    // flag to show the credentials form
    const showCredentialsForm = !hasCredentials;
    // flag to show the panorama viewer
    const showPanoramaViewer = StreetSmartApi && initialized && imageId && !showCredentialsForm && !error;
    // flag to show the empty view
    const showEmptyView = !showCredentialsForm && !showPanoramaViewer && !error;

    // create the iframe content
    const srcDoc = `<html>
        <head>
            <style>
                html, body, #ms-street-smart-viewer-container {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
            </style>
            <script type="text/javascript" src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
            <script type="text/javascript" src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
            <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>
            <script type="text/javascript" src="${StreetSmartApiURL}" ></script>
            <script>
                    window.StreetSmartApi = StreetSmartApi
            </script>
            </head>
            <body>
                <div key="main" id="ms-street-smart-viewer-container" />

            </body>
        </html>`;
    return (<>
        {<CyclomediaCredentials
            key="credentials"
            credentials={credentials}
            setCredentials={(newCredentials) => {
                setCredentials(newCredentials);
                setStoredCredentials(CYCLOMEDIA_CREDENTIALS_REFERENCE, newCredentials);
            }}/>}
        {showEmptyView ? <EmptyView key="empty-view" StreetSmartApi={StreetSmartApi} style={style} initializing={initializing} initialized={initialized}  mapPointVisible={mapPointVisible}/> : null}
        <iframe key="iframe" ref={viewer} onLoad={() => {
            setTargetElement(viewer.current?.contentDocument.querySelector('#ms-street-smart-viewer-container'));
            setStreetSmartApi(viewer.current?.contentWindow.StreetSmartApi);
        }} style={{ ...style, display: showPanoramaViewer ? 'block' : 'none'}}  srcDoc={srcDoc}>

        </iframe>
        <Alert bsStyle="danger" style={{...style, textAlign: 'center', alignContent: 'center', display: error ? 'block' : 'none'}} key="error">
            <Message msgId="streetView.cyclomedia.errorOccurred" />
            {getErrorMessage(error)}
            {initialized ? <div><Button
                onClick={() => {
                    setError(null);
                    try {
                        setReload(reload + 1);
                    } catch (e) {
                        console.error(e);
                    }
                }}>
                <Message msgId="streetView.cyclomedia.reloadAPI"/>
            </Button></div> : null}
        </Alert>
    </>);
};

export default CyclomediaView;
