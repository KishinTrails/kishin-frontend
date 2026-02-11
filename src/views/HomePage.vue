<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="fogCanvas" class="fog-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Fog of War</h3>
          
          <div class="control-group">
            <label>Mode</label>
            <ion-button 
              expand="block" 
              @click="followTouch = !followTouch"
              :color="followTouch ? 'primary' : 'secondary'"
            >
              {{ followTouch ? '👆 Touch Mode' : '📍 GPS Mode' }}
            </ion-button>
          </div>

          <div v-if="!followTouch" class="control-group">
            <label>Active Viewports ({{ gpsCoordinates.length }})</label>
            <div class="gps-list">
              <div v-for="(coord, index) in gpsCoordinates" :key="index" class="gps-item">
                📍 {{ coord.name }} ({{ coord.lat.toFixed(2) }}, {{ coord.lng.toFixed(2) }})
              </div>
            </div>
          </div>
          
          <div class="control-group">
            <label>View Distance (Base)</label>
            <ion-range 
              v-model="baseCircleRadius" 
              :min="50" 
              :max="400" 
              :step="10"
              :pin="true"
              @ionChange="updateCircleRadius"
            ></ion-range>
            <div class="value-display">{{ baseCircleRadius }}px (actual: {{ Math.round(circleRadius) }}px)</div>
          </div>

          <div class="control-group">
            <label>Current Zoom Level</label>
            <div class="value-display zoom-display">{{ currentZoom.toFixed(2) }}</div>
          </div>

          <div class="control-group">
            <label>Fog Opacity</label>
            <ion-range 
              v-model="fogOpacity" 
              :min="0" 
              :max="1" 
              :step="0.05"
              :pin="true"
            ></ion-range>
            <div class="value-display">{{ (fogOpacity * 100).toFixed(0) }}%</div>
          </div>

          <div class="control-group">
            <label>Edge Blur</label>
            <ion-range 
              v-model="edgeBlur" 
              :min="0" 
              :max="100" 
              :step="5"
              :pin="true"
            ></ion-range>
            <div class="value-display">{{ edgeBlur }}px</div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent, IonRange, IonButton } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Refs
const mapContainer = ref<HTMLElement | null>(null);
const fogCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map | null>(null);
const fogCtx = ref<CanvasRenderingContext2D | null>(null);

// State
const baseCircleRadius = ref(150); // Base radius at zoom level 1
const circleRadius = ref(150); // Actual calculated radius
const fogOpacity = ref(0.85);
const fogColor = ref('#1a1a1a');
const edgeBlur = ref(30);
const followTouch = ref(false); // Disabled by default when using GPS coordinates
const touchX = ref(0);
const touchY = ref(0);
const animationFrame = ref<number | null>(null);
const currentZoom = ref(4);

// GPS coordinates for viewports (add your coordinates here)
const gpsCoordinates = ref([
  { lat: 45.68866353482008, lng: 2.9987939167767763, name: '' },
  { lat: 45.68858935497701, lng: 2.9989700205624104, name: '' },
  { lat: 45.688505452126265, lng: 2.9990445356816053, name: '' },
  { lat: 45.6883739400655, lng: 2.999201864004135, name: '' },
  { lat: 45.68824661895633, lng: 2.9993134271353483, name: '' },
  { lat: 45.68814888596535, lng: 2.9994078911840916, name: '' },
  { lat: 45.68796272389591, lng: 2.9994956497102976, name: '' },
  { lat: 45.68787295371294, lng: 2.9995406605303288, name: '' },
  { lat: 45.68775326013565, lng: 2.9996190313249826, name: '' },
  { lat: 45.68764538504183, lng: 2.999691031873226, name: '' },
  { lat: 45.68752074614167, lng: 2.9997606854885817, name: '' },
  { lat: 45.687425611540675, lng: 2.999803349375725, name: '' },
  { lat: 45.68733584135771, lng: 2.999836876988411, name: '' },
  { lat: 45.6871772557497, lng: 2.999900747090578, name: '' },
  { lat: 45.68704859353602, lng: 2.9999315924942493, name: '' },
  { lat: 45.68694055080414, lng: 2.9999373760074377, name: '' },
  { lat: 45.686846589669585, lng: 2.9999562352895737, name: '' },
  { lat: 45.68675204180181, lng: 2.9999516252428293, name: '' },
  { lat: 45.6866542249918, lng: 2.999934358522296, name: '' },
  { lat: 45.68656009621918, lng: 2.999918684363365, name: '' },
  { lat: 45.68647208623588, lng: 2.999864788725972, name: '' },
  { lat: 45.68637041375041, lng: 2.9997828137129545, name: '' },
  { lat: 45.68626631051302, lng: 2.999706035479903, name: '' },
  { lat: 45.6861481256783, lng: 2.9996143374592066, name: '' },
  { lat: 45.686048213392496, lng: 2.9995599389076233, name: '' },
  { lat: 45.68592248484492, lng: 2.9995182808488607, name: '' },
  { lat: 45.685767251998186, lng: 2.999454578384757, name: '' },
  { lat: 45.68565359339118, lng: 2.9994291812181473, name: '' },
  { lat: 45.685551753267646, lng: 2.9993984196335077, name: '' },
  { lat: 45.68545611575246, lng: 2.9993619583547115, name: '' },
  { lat: 45.68536676466465, lng: 2.999324658885598, name: '' },
  { lat: 45.68528135307133, lng: 2.9992674104869366, name: '' },
  { lat: 45.685140788555145, lng: 2.99924754537642, name: '' },
  { lat: 45.6850500125438, lng: 2.999278223142028, name: '' },
  { lat: 45.684960409998894, lng: 2.999262884259224, name: '' },
  { lat: 45.684867622330785, lng: 2.999228937551379, name: '' },
  { lat: 45.68472194485366, lng: 2.999197170138359, name: '' },
  { lat: 45.684624714776874, lng: 2.999187782406807, name: '' },
  { lat: 45.684518683701754, lng: 2.9991823341697454, name: '' },
  { lat: 45.68442329764366, lng: 2.9991316236555576, name: '' },
  { lat: 45.684267058968544, lng: 2.999011343345046, name: '' },
  { lat: 45.684227496385574, lng: 2.998890057206154, name: '' },
  { lat: 45.68420268595219, lng: 2.9987612273544073, name: '' },
  { lat: 45.68424476310611, lng: 2.9986206628382206, name: '' },
  { lat: 45.684389686211944, lng: 2.9984866362065077, name: '' },
  { lat: 45.68454693071544, lng: 2.9984139651060104, name: '' },
  { lat: 45.68463334813714, lng: 2.998376162722707, name: '' },
  { lat: 45.68475848995149, lng: 2.9983994644135237, name: '' },
  { lat: 45.68485060706735, lng: 2.9984330758452415, name: '' },
  { lat: 45.685028890147805, lng: 2.998526366427541, name: '' },
  { lat: 45.68516400642693, lng: 2.9985597264021635, name: '' },
  { lat: 45.68526475690305, lng: 2.998488061130047, name: '' },
  { lat: 45.68536483682692, lng: 2.998446235433221, name: '' },
  { lat: 45.685462821274996, lng: 2.998443301767111, name: '' },
  { lat: 45.68555376492441, lng: 2.9984442237764597, name: '' },
  { lat: 45.68566935136914, lng: 2.9983483348041773, name: '' },
  { lat: 45.68560036830604, lng: 2.9981910064816475, name: '' },
  { lat: 45.685680666938424, lng: 2.998277423903346, name: '' },
  { lat: 45.685784770175815, lng: 2.998259235173464, name: '' },
  { lat: 45.68589792586863, lng: 2.9982069320976734, name: '' },
  { lat: 45.68599498830736, lng: 2.9981041699647903, name: '' },
  { lat: 45.6860841717571, lng: 2.9980257991701365, name: '' },
  { lat: 45.68617989309132, lng: 2.997910799458623, name: '' },
  { lat: 45.686283241957426, lng: 2.997770654037595, name: '' },
  { lat: 45.686393128708005, lng: 2.997674345970154, name: '' },
  { lat: 45.686442498117685, lng: 2.9975575022399426, name: '' },
  { lat: 45.686378041282296, lng: 2.997462200000882, name: '' },
  { lat: 45.68628936074674, lng: 2.9973342921584845, name: '' },
  { lat: 45.68631559610367, lng: 2.9972069710493088, name: '' },
  { lat: 45.68633294664323, lng: 2.9970000218600035, name: '' },
  { lat: 45.686282739043236, lng: 2.9967806674540043, name: '' },
  { lat: 45.686247451230884, lng: 2.996650915592909, name: '' },
  { lat: 45.686183078214526, lng: 2.996535748243332, name: '' },
  { lat: 45.68607813678682, lng: 2.9964286275207996, name: '' },
  { lat: 45.68601527251303, lng: 2.996309185400605, name: '' },
  { lat: 45.685928938910365, lng: 2.9962358437478542, name: '' },
  { lat: 45.685816537588835, lng: 2.996178762987256, name: '' },
  { lat: 45.685717882588506, lng: 2.9961889050900936, name: '' },
  { lat: 45.68560363724828, lng: 2.9962068423628807, name: '' },
  { lat: 45.68550506606698, lng: 2.996186390519142, name: '' },
  { lat: 45.68538864143193, lng: 2.996258055791259, name: '' },
  { lat: 45.68527397699654, lng: 2.9963084310293198, name: '' },
  { lat: 45.68519979715347, lng: 2.9961673635989428, name: '' },
  { lat: 45.68517037667334, lng: 2.995969383046031, name: '' },
  { lat: 45.68506711162627, lng: 2.9958249628543854, name: '' },
  { lat: 45.68503727205098, lng: 2.995678363367915, name: '' },
  { lat: 45.685002990067005, lng: 2.9955297522246838, name: '' },
  { lat: 45.6848874874413, lng: 2.995504019781947, name: '' },
  { lat: 45.684800650924444, lng: 2.9955595917999744, name: '' },
  { lat: 45.68471138365567, lng: 2.9955778643488884, name: '' },
  { lat: 45.684621362015605, lng: 2.995604518800974, name: '' },
  { lat: 45.684539219364524, lng: 2.9956677183508873, name: '' },
  { lat: 45.684439139440656, lng: 2.9957677144557238, name: '' },
  { lat: 45.684381388127804, lng: 2.995893359184265, name: '' },
  { lat: 45.684265131130815, lng: 2.9959562234580517, name: '' },
  { lat: 45.684125907719135, lng: 2.9960569739341736, name: '' },
  { lat: 45.684033120051026, lng: 2.9958997294306755, name: '' },
  { lat: 45.68398576229811, lng: 2.9957101307809353, name: '' },
  { lat: 45.68399825133383, lng: 2.9955589212477207, name: '' },
  { lat: 45.68402113392949, lng: 2.9953749384731054, name: '' },
  { lat: 45.68399481475353, lng: 2.9951808135956526, name: '' },
  { lat: 45.68389976397157, lng: 2.994969841092825, name: '' },
  { lat: 45.68381720222533, lng: 2.9948969185352325, name: '' },
  { lat: 45.68374855443835, lng: 2.9947314597666264, name: '' },
  { lat: 45.68376456387341, lng: 2.994550745934248, name: '' },
  { lat: 45.68379633128643, lng: 2.9944163002073765, name: '' },
  { lat: 45.683781411498785, lng: 2.99417314119637, name: '' },
  { lat: 45.68370413035154, lng: 2.993987901136279, name: '' },
  { lat: 45.68365886807442, lng: 2.993876002728939, name: '' },
  { lat: 45.683671440929174, lng: 2.993633011355996, name: '' },
  { lat: 45.683684181421995, lng: 2.9934644512832165, name: '' },
  { lat: 45.683700274676085, lng: 2.9933375492691994, name: '' },
  { lat: 45.683767748996615, lng: 2.9932273272424936, name: '' },
  { lat: 45.68383555859327, lng: 2.9931210447102785, name: '' },
  { lat: 45.683927340433, lng: 2.9929410852491856, name: '' },
  { lat: 45.68403529934585, lng: 2.9928151052445173, name: '' },
  { lat: 45.6841363850981, lng: 2.992686778306961, name: '' },
  { lat: 45.684218779206276, lng: 2.9925868660211563, name: '' },
  { lat: 45.68429270759225, lng: 2.992415875196457, name: '' },
  { lat: 45.68434459157288, lng: 2.99230900593102, name: '' },
  { lat: 45.6843972299248, lng: 2.9922021366655827, name: '' },
  { lat: 45.684499237686396, lng: 2.992033576592803, name: '' },
  { lat: 45.68453083746135, lng: 2.9919065069407225, name: '' },
  { lat: 45.68457802757621, lng: 2.99177885055542, name: '' },
  { lat: 45.68471976555884, lng: 2.991680698469281, name: '' },
  { lat: 45.68480827845633, lng: 2.991620684042573, name: '' },
  { lat: 45.684929648414254, lng: 2.9915571492165327, name: '' },
  { lat: 45.68501648493111, lng: 2.9915059357881546, name: '' },
  { lat: 45.6851501762867, lng: 2.9916155710816383, name: '' },
  { lat: 45.68514942191541, lng: 2.991808019578457, name: '' },
  { lat: 45.68515160121024, lng: 2.9919533617794514, name: '' },
  { lat: 45.685146655887365, lng: 2.992145223543048, name: '' },
  { lat: 45.68514338694513, lng: 2.9922994505614042, name: '' },
  { lat: 45.685149505734444, lng: 2.9924793262034655, name: '' },
  { lat: 45.68514732643962, lng: 2.992674373090267, name: '' },
  { lat: 45.685149505734444, lng: 2.992811668664217, name: '' },
  { lat: 45.685129472985864, lng: 2.9929602798074484, name: '' },
  { lat: 45.685141291469336, lng: 2.9931832384318113, name: '' },
  { lat: 45.685196947306395, lng: 2.9933808837085962, name: '' },
  { lat: 45.68527112714946, lng: 2.9935613460838795, name: '' },
  { lat: 45.685342540964484, lng: 2.9936793632805347, name: '' },
  { lat: 45.68540884181857, lng: 2.9937880765646696, name: '' },
  { lat: 45.685481345281005, lng: 2.993891006335616, name: '' },
  { lat: 45.68555862642825, lng: 2.993990834802389, name: '' },
  { lat: 45.685634231194854, lng: 2.9940840415656567, name: '' },
  { lat: 45.6856872048229, lng: 2.9942104406654835, name: '' },
  { lat: 45.68573355674744, lng: 2.9943261109292507, name: '' },
  { lat: 45.68582500331104, lng: 2.99439056776464, name: '' },
  { lat: 45.68592181429267, lng: 2.9944651667028666, name: '' },
  { lat: 45.686030611395836, lng: 2.99448536708951, name: '' },
  { lat: 45.686133122071624, lng: 2.9944946710020304, name: '' },
  { lat: 45.686275362968445, lng: 2.994468854740262, name: '' },
  { lat: 45.68639053031802, lng: 2.9944349080324173, name: '' },
  { lat: 45.68650075234473, lng: 2.99441646784544, name: '' },
  { lat: 45.686659002676606, lng: 2.9943679366260767, name: '' },
  { lat: 45.686796801164746, lng: 2.9943552799522877, name: '' },
  { lat: 45.686894953250885, lng: 2.9943249374628067, name: '' },
  { lat: 45.68701540119946, lng: 2.994193509221077, name: '' },
  { lat: 45.68716652691364, lng: 2.994092758744955, name: '' },
  { lat: 45.68728035315871, lng: 2.994066523388028, name: '' },
  { lat: 45.687444135546684, lng: 2.9939718078821898, name: '' },
  { lat: 45.6875488255173, lng: 2.993989074602723, name: '' },
  { lat: 45.687669944018126, lng: 2.994007095694542, name: '' },
  { lat: 45.687784189358354, lng: 2.994022434577346, name: '' },
  { lat: 45.68791151046753, lng: 2.994045987725258, name: '' },
  { lat: 45.688002202659845, lng: 2.9940601531416178, name: '' },
  { lat: 45.68815911188722, lng: 2.9940375220030546, name: '' },
  { lat: 45.688321301713586, lng: 2.9939701315015554, name: '' },
  { lat: 45.68847645074129, lng: 2.9939500987529755, name: '' },
  { lat: 45.68857837468386, lng: 2.993949009105563, name: '' },
  { lat: 45.688686752691865, lng: 2.993958229199052, name: '' },
  { lat: 45.68883745931089, lng: 2.993999132886529, name: '' },
  { lat: 45.68896637298167, lng: 2.993967868387699, name: '' },
  { lat: 45.68908187560737, lng: 2.9939341731369495, name: '' },
  { lat: 45.68915454670787, lng: 2.993819173425436, name: '' },
  { lat: 45.68924641236663, lng: 2.9936541337519884, name: '' },
  { lat: 45.68933970294893, lng: 2.993564698845148, name: '' },
  { lat: 45.689425617456436, lng: 2.9934962186962366, name: '' },
  { lat: 45.68951312452555, lng: 2.9933300893753767, name: '' },
  { lat: 45.689648324623704, lng: 2.9933231323957443, name: '' },
  { lat: 45.689746057614684, lng: 2.9934211168438196, name: '' },
  { lat: 45.68982124328613, lng: 2.993513820692897, name: '' },
  { lat: 45.68986943922937, lng: 2.993671400472522, name: '' },
  { lat: 45.68990623578429, lng: 2.993798889219761, name: '' },
  { lat: 45.68988217972219, lng: 2.993934005498886, name: '' },
  { lat: 45.68985032849014, lng: 2.994094267487526, name: '' },
  { lat: 45.689828619360924, lng: 2.994247991591692, name: '' },
  { lat: 45.68979559466243, lng: 2.9944074992090464, name: '' },
  { lat: 45.68975334987044, lng: 2.9945256002247334, name: '' },
  { lat: 45.68976994603872, lng: 2.9947275202721357, name: '' },
  { lat: 45.68983658216894, lng: 2.9948486387729645, name: '' },
  { lat: 45.68994261324406, lng: 2.9949110839515924, name: '' },
  { lat: 45.69004747085273, lng: 2.994949808344245, name: '' },
  { lat: 45.69013531319797, lng: 2.995127337053418, name: '' },
  { lat: 45.69020848721266, lng: 2.995286090299487, name: '' },
  { lat: 45.69029523991048, lng: 2.9954243917018175, name: '' },
  { lat: 45.69036556407809, lng: 2.995523801073432, name: '' },
  { lat: 45.69046027958393, lng: 2.9955996572971344, name: '' },
  { lat: 45.69057268090546, lng: 2.9956750106066465, name: '' },
  { lat: 45.690701426938176, lng: 2.995779952034354, name: '' },
  { lat: 45.69079480133951, lng: 2.995842732489109, name: '' },
  { lat: 45.690859258174896, lng: 2.9959439020603895, name: '' },
  { lat: 45.690898820757866, lng: 2.996158814057708, name: '' },
  { lat: 45.69090032950044, lng: 2.996373390778899, name: '' },
  { lat: 45.69094332866371, lng: 2.9965406097471714, name: '' },
  { lat: 45.69096461869776, lng: 2.9967461340129375, name: '' },
  { lat: 45.69100786931813, lng: 2.996903294697404, name: '' },
  { lat: 45.69099521264434, lng: 2.997036650776863, name: '' },
  { lat: 45.69090695120394, lng: 2.997271092608571, name: '' },
  { lat: 45.69081609137356, lng: 2.997364467009902, name: '' },
  { lat: 45.690682819113135, lng: 2.9974808916449547, name: '' },
  { lat: 45.6905463617295, lng: 2.9976243060082197, name: '' },
  { lat: 45.690447706729174, lng: 2.9977120645344257, name: '' },
  { lat: 45.69035919383168, lng: 2.997810300439596, name: '' },
  { lat: 45.690284594893456, lng: 2.9979580733925104, name: '' },
  { lat: 45.690234303474426, lng: 2.998126884922385, name: '' },
  { lat: 45.690139001235366, lng: 2.9982166551053524, name: '' },
  { lat: 45.68999885581434, lng: 2.998299468308687, name: '' },
  { lat: 45.68991160020232, lng: 2.9983496759086847, name: '' },
  { lat: 45.68978587165475, lng: 2.9984251968562603, name: '' },
  { lat: 45.689620496705174, lng: 2.99848236143589, name: '' },
  { lat: 45.689503233879805, lng: 2.99848772585392, name: '' },
  { lat: 45.689312713220716, lng: 2.9985222592949867, name: '' },
  { lat: 45.68921606987715, lng: 2.9984991252422333, name: '' },
  { lat: 45.689035607501864, lng: 2.998565174639225, name: '' },
  { lat: 45.68887115456164, lng: 2.9986681044101715, name: '' },
  { lat: 45.68872950039804, lng: 2.998816045001149, name: '' },
]);

// Store screen positions for each GPS coordinate
const viewportPositions = ref<Array<{ x: number; y: number; name: string }>>([]);

onMounted(() => {
  // Wait for DOM to be ready
  setTimeout(() => {
    initMap();
    initFogCanvas();
    setupEventListeners();
    animate();
  }, 100);
});

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }
  if (map.value) {
    map.value.remove();
  }
});

const initMap = () => {
  if (!mapContainer.value) return;

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    },
    center: [2.3522, 48.8566], // Paris
    zoom: 4
  });

  // Add navigation controls
  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Update circle radius when zoom changes
  map.value.on('zoom', updateCircleRadius);
  
  // Update viewport positions when map moves or zooms
  map.value.on('move', updateViewportPositions);
  map.value.on('zoom', updateViewportPositions);
  
  // Initial radius calculation and positions
  map.value.on('load', () => {
    updateCircleRadius();
    updateViewportPositions();
  });
};

const initFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCtx.value = fogCanvas.value.getContext('2d');
  resizeFogCanvas();
  
  // Initialize touch position to center
  touchX.value = window.innerWidth / 2;
  touchY.value = window.innerHeight / 2;
};

const resizeFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCanvas.value.width = window.innerWidth;
  fogCanvas.value.height = window.innerHeight;
};

const updateCircleRadius = () => {
  if (!map.value) return;
  
  const zoom = map.value.getZoom();
  currentZoom.value = zoom;
  
  // Calculate radius based on zoom level
  // The circle covers the same geographic area regardless of zoom
  // Formula: radius increases with zoom level (higher zoom = more pixels for same geographic area)
  // We use zoom level 10 as reference point
  const referenceZoom = 17;
  const zoomDifference = zoom - referenceZoom;
  
  // At zoom 10, use baseCircleRadius
  // Each zoom level doubles the radius (higher zoom = bigger circle in pixels)
  circleRadius.value = baseCircleRadius.value * Math.pow(2, zoomDifference);
};

const updateViewportPositions = () => {
  if (!map.value) return;
  
  // Convert each GPS coordinate to screen position
  viewportPositions.value = gpsCoordinates.value.map(coord => {
    const point = map.value!.project([coord.lng, coord.lat]);
    return {
      x: point.x,
      y: point.y,
      name: coord.name
    };
  });
};

const setupEventListeners = () => {
  // Touch events for mobile
  const handleTouch = (e: TouchEvent) => {
    if (followTouch.value && e.touches.length > 0) {
      // Prevent default to avoid scrolling
      e.preventDefault();
      touchX.value = e.touches[0].clientX;
      touchY.value = e.touches[0].clientY;
    }
  };

  window.addEventListener('touchstart', handleTouch, { passive: false });
  window.addEventListener('touchmove', handleTouch, { passive: false });

  // Mouse events for desktop testing
  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (followTouch.value) {
      touchX.value = e.clientX;
      touchY.value = e.clientY;
    }
  });

  // Handle window resize (orientation changes on mobile)
  window.addEventListener('resize', () => {
    resizeFogCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

const drawFog = () => {
  if (!fogCtx.value || !fogCanvas.value) return;

  const ctx = fogCtx.value;
  const width = fogCanvas.value.width;
  const height = fogCanvas.value.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Create fog layer with circular cutout
  ctx.save();

  // Fill entire canvas with fog
  ctx.fillStyle = hexToRgba(fogColor.value, fogOpacity.value);
  ctx.fillRect(0, 0, width, height);

  // Use composite operation to cut out the visible circles
  ctx.globalCompositeOperation = 'destination-out';

  // Ensure we have a valid radius
  const radius = Math.max(1, circleRadius.value);
  const blur = Math.min(edgeBlur.value, radius * 0.9);
  const innerRadius = Math.max(0, radius - blur);
  const outerRadius = radius;

  // Draw a circle for each viewport position
  if (followTouch.value) {
    // If following touch, draw single circle at touch position
    const gradient = ctx.createRadialGradient(
      touchX.value, touchY.value, innerRadius,
      touchX.value, touchY.value, outerRadius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(touchX.value, touchY.value, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  } else {
    // Draw circles at GPS-based viewport positions
    viewportPositions.value.forEach(pos => {
      const gradient = ctx.createRadialGradient(
        pos.x, pos.y, innerRadius,
        pos.x, pos.y, outerRadius
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }

  ctx.restore();
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const animate = () => {
  drawFog();
  animationFrame.value = requestAnimationFrame(animate);
};
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
}

.fog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 2;
  max-width: 300px;
}

.controls h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.value-display {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  text-align: center;
}

.zoom-display {
  font-weight: bold;
  color: #007bff;
  font-size: 14px;
}

.gps-list {
  max-height: 150px;
  overflow-y: auto;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
}

.gps-item {
  font-size: 12px;
  padding: 4px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
}

.gps-item:last-child {
  border-bottom: none;
}

/* Ensure proper rendering on mobile */
ion-content {
  --background: transparent;
}

/* Fix for iOS safe areas */
@supports (padding: max(0px)) {
  .controls {
    top: max(20px, env(safe-area-inset-top));
    left: max(20px, env(safe-area-inset-left));
  }
}
</style>
