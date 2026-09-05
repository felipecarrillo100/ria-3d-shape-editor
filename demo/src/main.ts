// Minimal demo, backend-agnostic on purpose: persistence goes through RIA's own MemoryStore, not
// ria-wfststore/WFS-T - proving this controller needs nothing backend-specific, and letting this
// demo run with zero server/docker setup. ria-3d-shape-editor itself is imported straight from
// source (see vite.config.ts's alias) - edits there show up here on save, no build step needed.
import { RIAMap } from '@luciad/ria/view/RIAMap.js'
import { getReference } from '@luciad/ria/reference/ReferenceProvider.js'
import { WMSTileSetModel } from '@luciad/ria/model/tileset/WMSTileSetModel.js'
import { WMSTileSetLayer } from '@luciad/ria/view/tileset/WMSTileSetLayer.js'
import { OGC3DTilesModel } from '@luciad/ria/model/tileset/OGC3DTilesModel.js'
import { TileSet3DLayer } from '@luciad/ria/view/tileset/TileSet3DLayer.js'
import { createBounds } from '@luciad/ria/shape/ShapeFactory.js'
import { MemoryStore } from '@luciad/ria/model/store/MemoryStore.js'
import { FeatureModel } from '@luciad/ria/model/feature/FeatureModel.js'
import { FeatureLayer } from '@luciad/ria/view/feature/FeatureLayer.js'
import { Feature } from '@luciad/ria/model/feature/Feature.js'
import { ShapeType } from '@luciad/ria/shape/ShapeType.js'
import { Shape3DEditController } from 'ria-3d-shape-editor'
import type { EditableShape, SupportedShapeType, UomFamily } from 'ria-3d-shape-editor'

// The 3D side of the 2D/3D toggle has to be geocentric - RIA only draws a globe on EPSG:4978 -
// so WebMercator is the 2D half. The feature model keeps EPSG:4978 either way: model coordinates
// are transformed to whatever the map's reference currently is, so shapes created in one mode stay
// put (and stay editable, heights included) in the other.
const REFERENCE_3D = getReference('EPSG:4978')
const REFERENCE_2D = getReference('EPSG:3857')

const reference = REFERENCE_3D
const map = new RIAMap(document.getElementById('map') as HTMLDivElement, { reference })

// The editable layer's model/layer are built synchronously, before the tile sets are awaited below,
// so every toolbar handler and controller further down this file has a `layer` to close over from
// the moment the module runs. Only its placement in the layer tree waits.
const store = new MemoryStore()
const model = new FeatureModel(store, { reference })
const layer = new FeatureLayer(model, { label: 'Shapes (MemoryStore)', selectable: true, hoverable: true })

// A real mesh (buildings, not just terrain/imagery) so people have something convenient to edit
// near/behind/on top of - occlusion coloring, "went underground," etc. are much easier to try out
// against actual 3D structures than a bare globe.
//
// Both models are fetched in parallel and awaited together, rather than each adding its own layer
// from a `.then()`. That's purely about stacking order: `addChild` defaults to "top", so
// then-callbacks would order the layers by whichever network request happened to finish first, and
// would bury the editable layer underneath both (it being the only one added synchronously). Adding
// all three here, after the await, makes the three lines below literally the stacking order - no
// `position` arguments, nothing timing-dependent to reason about.
const [wmsModel, meshModel] = await Promise.all([
  WMSTileSetModel.createFromURL(
    'https://sampleservices.luciad.com/wms',
    [{ layer: '4ceea49c-3e7c-4e2d-973d-c608fb2fb07e' }],
    {},
  ),
  OGC3DTilesModel.create('https://sampleservices.luciad.com/ogc/3dtiles/marseille-mesh/tileset.json'),
])

// Bottom to top.
map.layerTree.addChild(new WMSTileSetLayer(wmsModel, { label: 'Imagery' }))
map.layerTree.addChild(new TileSet3DLayer(meshModel, { label: 'Marseille mesh' }))
map.layerTree.addChild(layer)

// Fly to a small box centered on the mesh's own extent - dead center of a dense city mesh is a safe
// bet for "near a building" without needing to hardcode this dataset's actual coordinates.
const bounds = meshModel.bounds
const buildingScale = 150
const closeBounds = createBounds(bounds.reference, [
  bounds.x + bounds.width / 2 - buildingScale / 2, buildingScale,
  bounds.y + bounds.height / 2 - buildingScale / 2, buildingScale,
  bounds.z + bounds.depth / 2 - buildingScale / 2, buildingScale,
])
map.mapNavigator.fit({ bounds: closeBounds, animate: true }).catch((err: unknown) => console.error('fit failed:', err))

// FeatureLayer.setEditedObject exists at runtime but isn't declared in RIA's public .d.ts - see
// the equivalent workaround (and the reason it's needed: without it, the layer keeps rendering a
// stale, cached pre-edit snapshot of an existing feature instead of tracking the live drag) in
// ria-wfststore's demo-3d, Shape3DEditHelper.ts.
function setEditedObject(target: FeatureLayer, feature: Feature | null): void {
  ;(target as unknown as { setEditedObject(f: Feature | null): void }).setEditedObject(feature)
}

const SHAPE_TYPE_MAP: Record<string, SupportedShapeType> = {
  point: ShapeType.POINT,
  line: ShapeType.POLYLINE,
  polygon: ShapeType.POLYGON,
}

const htmlToolbarCheckbox = document.getElementById('chk-html-toolbar') as HTMLInputElement
const uomSelect = document.getElementById('sel-uom') as HTMLSelectElement

// Tracked so the Units dropdown can retarget the LIVE session via updateController() rather than
// only affecting the next one - switching units mid-drag is exactly what that option is for.
let activeController: Shape3DEditController | null = null

function selectedUom(): UomFamily {
  return uomSelect.value as UomFamily
}

uomSelect.addEventListener('change', () => {
  activeController?.updateController({ uom: selectedUom() })
})

function startCreate(kind: keyof typeof SHAPE_TYPE_MAP): void {
  const ctrl = new Shape3DEditController(SHAPE_TYPE_MAP[kind], layer,
    {htmlToolbar: htmlToolbarCheckbox.checked, uom: selectedUom()})
  activeController = ctrl
  ctrl.on('ShapeEditingFinished', ({ shape, confirmed }) => {
    if (!confirmed) return
    const feature = new Feature(shape, {})
    // MemoryStore.add() is synchronous, but Promise.resolve() on a plain value just resolves
    // immediately - this is the exact same glue used for WFS-T's async store.add(), unmodified.
    Promise.resolve(store.add(feature)).catch((err: unknown) => console.error('add failed:', err))
  })
  map.controller = ctrl
  setActiveButton('btn-' + kind)
}

function startEdit(feature: Feature): void {
  const shape = feature.shape
  if (!shape) return
  const shapeType = shape.type as SupportedShapeType
  setEditedObject(layer, feature)
  const ctrl = new Shape3DEditController(shapeType, layer,
    { existingShape: shape as EditableShape, htmlToolbar: htmlToolbarCheckbox.checked, uom: selectedUom() })
  activeController = ctrl
  ctrl.on('ShapeEditingFinished', ({ shape: editedShape, confirmed }) => {
    if (!confirmed) {
      setEditedObject(layer, null)
      return
    }
    const updated = new Feature(editedShape, feature.properties, feature.id)
    Promise.resolve(store.put(updated))
      .catch((err: unknown) => console.error('put failed:', err))
      .finally(() => setEditedObject(layer, null))
  })
  map.controller = ctrl
  setActiveButton('btn-edit')
}

// RIAMap.reference can only be swapped wholesale: the setter tears down and rebuilds the render
// context (layers unload and reload, map.controller is reset to null), and it saves/restores the
// camera state across the switch so the view stays roughly where it was.
const dimensionButton = document.getElementById('btn-dimension') as HTMLButtonElement
let is3D = true

function syncDimensionButton(): void {
  dimensionButton.textContent = is3D ? 'Switch to 2D' : 'Switch to 3D'
}

dimensionButton.addEventListener('click', () => {
  // Drop the controller first so an in-progress create/edit is torn down through the normal
  // deactivate path - that emits ShapeEditingFinished with confirmed:false, which is what clears
  // the layer's edited object. Letting the reference setter null out map.controller instead would
  // leave an existing feature stuck in its hidden, mid-edit state.
  map.controller = null
  is3D = !is3D
  map.reference = is3D ? REFERENCE_3D : REFERENCE_2D
  syncDimensionButton()
})

syncDimensionButton()

document.getElementById('btn-point')!.addEventListener('click', () => startCreate('point'))
document.getElementById('btn-line')!.addEventListener('click', () => startCreate('line'))
document.getElementById('btn-polygon')!.addEventListener('click', () => startCreate('polygon'))
// Dropping the controller abandons any in-progress create/edit (onDeactivate emits
// ShapeEditingFinished with confirmed:false, so nothing reaches the store) and hands input back to
// map.defaultController - i.e. navigation plus the hover/click selection that arms "Edit Selected".
// It doubles as the idle-state indicator: this is the button setActiveButton() falls back to
// whenever map.controller goes null, including when a session finishes on its own.
document.getElementById('btn-cancel')!.addEventListener('click', () => {
  map.controller = null
})

const editButton = document.getElementById('btn-edit') as HTMLButtonElement
let selectedFeature: Feature | null = null

map.on('SelectionChanged', () => {
  const selectionInLayer = map.selectedObjects.find((s) => s.layer === layer)
  const selected = (selectionInLayer?.selected ?? []) as Feature[]
  selectedFeature = selected.length === 1 ? selected[0] : null
  editButton.disabled = !selectedFeature
})

editButton.addEventListener('click', () => {
  if (selectedFeature) startEdit(selectedFeature)
})

map.on('ControllerChanged', (newController) => {
  if (!newController) {
    activeController = null
    setActiveButton('btn-cancel')
  }
})

function setActiveButton(activeId: string): void {
  document.querySelectorAll('#toolbar button').forEach((button) => button.classList.remove('active'))
  document.getElementById(activeId)?.classList.add('active')
}
