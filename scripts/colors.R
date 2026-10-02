# assigns colors to each district, ordered by the first entitlement
metadata <- jsonlite::read_json("metadata.json")
entities <- as.data.frame(lapply(metadata$entities, unlist))
data <- as.data.frame(jsonlite::read_json(
  "public/data.json.gz",
  simplifyVector = TRUE
))
data <- data[order(data$general__fiscal_year), ]
data <- data[!duplicated(data$general__district), ]
entities$value <- structure(
  data$ecs__entitlement,
  names = data$general__district
)[entities$id]
entitlement_order <- order(order(-entities$value))
metadata$entities$light <- scico::scico(
  length(metadata$entities$id),
  palette = "berlin",
  direction = -1
)[entitlement_order]
metadata$entities$dark <- scico::scico(
  length(metadata$entities$id),
  palette = "managua",
  direction = -1
)[entitlement_order]
jsonlite::write_json(
  metadata,
  "metadata.json",
  auto_unbox = TRUE
)

# smaller versions of the same palettes for categorical contexts
# manually selected from and rearranged in app/data/make_series.ts
paste0(
  "'",
  paste(
    scico::scico(11, palette = "berlin"),
    collapse = "', '"
  ),
  "'"
)
paste0(
  "'",
  paste(
    scico::scico(11, palette = "managua"),
    collapse = "', '"
  ),
  "'"
)
