/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {withProps} from 'recompose';

/**
 * Add widget tools (menu items) needed to export widgets. @see withMenu
 */
export default () =>
    withProps(({ widgetTools = [], data, title, layer = () => { } }) => {
        return { widgetTools: [
            ...widgetTools,
            {
                glyph: "download",
                glyphClassName: "exportCSV",
                target: "menu",
                textId: "widgets.widget.menu.downloadData",
                disabled: false,
                onClick: () => {
                    // eslint-disable-next-line no-console
                    if (data === title) console.log("data is title");
                    const datasetUrl = `/api/v2/resources?include[]=executions&filter{metadata_only}=false&filter{resource_type.in}=dataset&search=${layer.name}&search_fields=alternate`;

                    fetch(datasetUrl).then(response => response.json()).then(resData => {
                        if (resData.total === 1) {
                            // eslint-disable-next-line no-console
                            console.log("resData", resData);
                            const downloadFileUrl = resData.resources[0].download_file_url;
                            // eslint-disable-next-line no-console
                            console.log("downloadFileUrl", downloadFileUrl);
                            window.open(downloadFileUrl, "_blank");
                        }
                    });
                }
            }
        ]
        };
    }
    );
