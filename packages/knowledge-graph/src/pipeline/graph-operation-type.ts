/**
 * The catalogue of Graph Operations from the specification (~35 operations). Every pipeline run
 * carries one of these so the Validation/Relationship Validation/Cycle Detection stages know which
 * guards apply, and so Metrics/Events know what to record/publish.
 */
export enum GraphOperationType {
  CreateGraph = "CreateGraph",
  DeleteGraph = "DeleteGraph",
  CloneGraph = "CloneGraph",
  SnapshotGraph = "SnapshotGraph",
  RestoreGraph = "RestoreGraph",
  MergeGraph = "MergeGraph",

  CreateNode = "CreateNode",
  UpdateNode = "UpdateNode",
  DeleteNode = "DeleteNode",
  MoveNode = "MoveNode",
  CopyNode = "CopyNode",
  FindNode = "FindNode",
  FindNodes = "FindNodes",

  CreateEdge = "CreateEdge",
  UpdateEdge = "UpdateEdge",
  DeleteEdge = "DeleteEdge",
  FindEdge = "FindEdge",
  FindEdges = "FindEdges",

  Connect = "Connect",
  Disconnect = "Disconnect",
  RelationshipExists = "RelationshipExists",

  Traversal = "Traversal",
  BreadthFirstSearch = "BreadthFirstSearch",
  DepthFirstSearch = "DepthFirstSearch",
  ShortestPath = "ShortestPath",
  FindNeighbors = "FindNeighbors",
  FindAncestors = "FindAncestors",
  FindDescendants = "FindDescendants",
  FindDependencies = "FindDependencies",
  FindDependents = "FindDependents",
  ImpactAnalysis = "ImpactAnalysis",
  CycleDetection = "CycleDetection",
  ConnectedComponents = "ConnectedComponents",
  SubGraph = "SubGraph",

  GraphValidation = "GraphValidation",
  GraphStatistics = "GraphStatistics",
}
