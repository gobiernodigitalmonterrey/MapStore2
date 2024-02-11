/*
 * Copyright 2018, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {withProps} from 'recompose';

const downloadUrl = (layer) => {
    const datasetUrl = `/api/v2/resources?include[]=executions&filter{metadata_only}=false&filter{resource_type.in}=dataset&search=${layer.name}&search_fields=alternate`;
    fetch(datasetUrl).then(response => response.json()).then(resData => {
        if (resData.total === 1) {
            const url = resData.resources[0].download_file_url;
            return url;
        }
    });
    return "";
};

/**
 * Add widget tools (menu items) needed to export widgets. @see withMenu
 */
export default () =>
    withProps(({ widgetTools = [], data, title, layer = () => { } }) => ({
        widgetTools: [
            ...widgetTools,
            {
                glyph: "download",
                glyphClassName: "exportCSV",
                target: "menu",
                textId: "widgets.widget.menu.downloadData",
                disabled: downloadUrl(layer) === "",
                onClick: () => {
                    const url = downloadUrl(layer);
                    if (!!url) {
                        window.open(url, "_blank");
                    }
                }
            }/* TODO: support for plotlyJS {
                glyph: "download",
                target: "menu",
                glyphClassName: "exportImage",
                textId: "widgets.widget.menu.exportImage",
                disabled: !data || !data.length,
                // NOTE: the widget widget-chart-${id} must be the id of the div to export as image
                onClick: () => exportImage({ widgetDivId: `widget-chart-${id}`, title })
            }*/
        ]
    }));
