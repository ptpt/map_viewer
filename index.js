require.config({
  paths: {
    'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.15.6/min/vs'
  }
});

// Before loading vs/editor/editor.main, define a global MonacoEnvironment that overwrites
// the default worker url location (used when creating WebWorkers). The problem here is that
// HTML5 does not allow cross-domain web workers, so we need to proxy the instantiation of
// a web worker through a same-domain script
window.MonacoEnvironment = {
  getWorkerUrl: function (workerId, label) {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
      self.MonacoEnvironment = {
        baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.15.6/min/'
      };
      importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.15.6/min/vs/base/worker/workerMain.js');`
    )}`;
  }
};

require(['vs/editor/editor.main', 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/3.12.2/js-yaml.min.js'], (monaco, jsyaml) => {
  const layers = localStorage.getItem('layers');
  const editor = monaco.editor.create(document.getElementById('editor-layers'), {
    lineNumbers: "off",
    value: layers,
    language: 'yaml',
    minimap: {
      'enabled': false,
    }
  });

  const model = editor.getModel();

  model.onDidChangeContent((event) => {
    localStorage.setItem('layers', editor.getValue());
  })

  mapboxgl.accessToken = 'pk.eyJ1IjoicHQiLCJhIjoiYzNkMDlmYzFkY2FmYjE3Y2E3MTAxNjgwMWE0YTI2ZDcifQ.MQenQX1GtH2UuXkKzLWJag';

  var hashParams = {};
  if (window.location.hash) {
    try {
      hashParams = JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
    } catch (error) {
      console.log(error);
    }
  }

  var options = {
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/streets-v9', //stylesheet location
  };

  if (hashParams.center !== undefined) {
    options.center = hashParams.center;
  }

  if (hashParams.zoom !== undefined) {
    options.zoom = hashParams.zoom;
  }

  var requests = [
  ];

  options.transformRequest = (url, resourceType) => {
    console.log(url);
    for (const request of requests) {
      const regexp = new RegExp(request.url_pattern);
      if (regexp.test(url)) {
        const ret = {
          url: request.url ? request.url : url,
          headers: request.headers,
          // 'same-origin'|'include'
          credentials: request.credentials,
        };
        console.log(ret);
        return ret;
      }
    }
  }

  const map = new mapboxgl.Map(options);

  function loadStyle(map) {
    const style = jsyaml.load(editor.getValue());
    if (style === undefined) {
      return;
    }
  
    console.log(style);

    if (style.requests) {
      requests = style.requests;
    } else {
      requests = [];
    }

    try {
      map.setStyle(style, { 'full': false });
    } catch (err) {
      console.error(err);
    }
  }

  const buttonRun = document.getElementById('button-run');
  buttonRun.onclick = (ev) => {
    loadStyle(map);
  };

  map.on('moveend', function () {
    let center = map.getCenter();
    hashParams.center = [center.lng, center.lat];
    hashParams.zoom = map.getZoom();
    if (hashParams) {
      window.location.hash = JSON.stringify(hashParams);
    }
  });

  map.addControl(new MapboxGeocoder({
    accessToken: mapboxgl.accessToken
  }));
  map.addControl(new mapboxgl.NavigationControl());
  map.addControl(new mapboxgl.GeolocateControl());

  map.on('load', () => {
    loadStyle(map);
  });
});