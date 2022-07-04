const monacoEditorVersion = "0.32.1";

require.config({
  paths: {
    vs: `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${monacoEditorVersion}/min/vs`,
  },
});

// Before loading vs/editor/editor.main, define a global MonacoEnvironment that overwrites
// the default worker url location (used when creating WebWorkers). The problem here is that
// HTML5 does not allow cross-domain web workers, so we need to proxy the instantiation of
// a web worker through a same-domain script
window.MonacoEnvironment = {
  getWorkerUrl: function (workerId, label) {
    const uri = encodeURIComponent(`
      self.MonacoEnvironment = {
        baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${monacoEditorVersion}/min/'
      };
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${monacoEditorVersion}/min/vs/base/worker/workerMain.js');`);
    return `data:text/javascript;charset=utf-8,${uri}`;
  },
};

require([
  "vs/editor/editor.main",
  "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/3.12.2/js-yaml.min.js",
], (monaco, jsyaml) => {
  const layers = localStorage.getItem("layers");
  const editor = monaco.editor.create(
    document.getElementById("editor-layers"),
    {
      lineNumbers: "off",
      value: layers,
      language: "yaml",
      minimap: {
        enabled: false,
      },
    }
  );

  const model = editor.getModel();

  model.onDidChangeContent((event) => {
    localStorage.setItem("layers", editor.getValue());
  });

  mapboxgl.accessToken =
    "pk.eyJ1IjoicHQiLCJhIjoiYzNkMDlmYzFkY2FmYjE3Y2E3MTAxNjgwMWE0YTI2ZDcifQ.MQenQX1GtH2UuXkKzLWJag";
  const defaultStyle = "mapbox://styles/mapbox/streets-v9"; // stylesheet location

  let style = {};
  try {
    style = jsyaml.load(editor.getValue());
  } catch (err) {
    const errorDecorations = editor.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(
            err.mark.line + 1,
            err.mark.column + 1,
            err.mark.line + 2,
            0
          ),
          options: {
            className: "yaml-error",
          },
        },
      ]
    );
  }

  if (!style) {
    style = {};
  }

  const options = {
    container: "map", // container id
    hash: true,
    style: style.base ? style.base : defaultStyle,
  };

  let requests = [];

  options.transformRequest = (url, resourceType) => {
    for (const request of requests) {
      const regexp = new RegExp(request.url_pattern);
      if (regexp.test(url)) {
        const newRequest = {
          url: request.url ? request.url : url,
        };
        if (request.headers) {
          newRequest.headers = request.headers;
        }
        if (request.credentials) {
          // 'same-origin'|'include'
          newRequest.credentials = request.credentials;
        }
        return newRequest;
      }
    }
  };

  if (style.requests) {
    requests = style.requests;
  } else {
    requests = [];
  }

  const map = new mapboxgl.Map(options);

  map.addControl(
    new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
    })
  );
  map.addControl(
    new mapboxgl.ScaleControl({
      maxWidth: 80,
      unit: "metric",
    })
  );

  map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
  map.addControl(new mapboxgl.GeolocateControl(), "bottom-right");
  map.addControl(new mapboxgl.FullscreenControl(), "bottom-right");

  map.showTileBoundaries = true;

  map.on("load", () => {
    const sources = style.sources || [];
    for (const id in sources) {
      if (Object.prototype.hasOwnProperty.call(sources, id)) {
        console.log("adding source:", id, sources[id]);
        map.addSource(id, sources[id]);
      }
    }

    const layers = style.layers || [];
    for (const layer of layers) {
      console.log("adding layer", layer);
      map.addLayer(layer);
    }
  });
});
