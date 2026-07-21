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
import type { EditableShape, SupportedShapeType } from 'ria-3d-shape-editor'

const reference = getReference('EPSG:4978')
const map = new RIAMap(document.getElementById('map') as HTMLDivElement, { reference })

WMSTileSetModel.createFromURL(
  'https://sampleservices.luciad.com/wms',
  [{ layer: '4ceea49c-3e7c-4e2d-973d-c608fb2fb07e' }],
  {},
).then((model) => {
  map.layerTree.addChild(new WMSTileSetLayer(model, { label: 'Imagery' }))
})

// A real mesh (buildings, not just terrain/imagery) so people have something convenient to edit
// near/behind/on top of - occlusion coloring, "went underground," etc. are much easier to try out
// against actual 3D structures than a bare globe. Once loaded, fly to a small box centered on the
// dataset's own extent - dead center of a dense city mesh is a safe bet for "near a building"
// without needing to hardcode this dataset's actual coordinates.
OGC3DTilesModel.create('https://sampleservices.luciad.com/ogc/3dtiles/marseille-mesh/tileset.json').then((model) => {
  map.layerTree.addChild(new TileSet3DLayer(model, { label: 'Marseille mesh' }))

  const bounds = model.bounds
  const buildingScale = 150
  const closeBounds = createBounds(bounds.reference, [
    bounds.x + bounds.width / 2 - buildingScale / 2, buildingScale,
    bounds.y + bounds.height / 2 - buildingScale / 2, buildingScale,
    bounds.z + bounds.depth / 2 - buildingScale / 2, buildingScale,
  ])
  map.mapNavigator.fit({ bounds: closeBounds, animate: true }).catch((err: unknown) => console.error('fit failed:', err))
})

const store = new MemoryStore()
const model = new FeatureModel(store, { reference })
const layer = new FeatureLayer(model, { label: 'Shapes (MemoryStore)', selectable: true, hoverable: true })
map.layerTree.addChild(layer)

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

function startCreate(kind: keyof typeof SHAPE_TYPE_MAP): void {
  const ctrl = new Shape3DEditController(SHAPE_TYPE_MAP[kind], layer, {showPlane: true, showDropLine: true})
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
  const ctrl = new Shape3DEditController(shapeType, layer, { existingShape: shape as EditableShape })
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

document.getElementById('btn-point')!.addEventListener('click', () => startCreate('point'))
document.getElementById('btn-line')!.addEventListener('click', () => startCreate('line'))
document.getElementById('btn-polygon')!.addEventListener('click', () => startCreate('polygon'))
document.getElementById('btn-select')!.addEventListener('click', () => {
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
  if (!newController) setActiveButton('btn-select')
})

function setActiveButton(activeId: string): void {
  document.querySelectorAll('#toolbar button').forEach((button) => button.classList.remove('active'))
  document.getElementById(activeId)?.classList.add('active')
}
