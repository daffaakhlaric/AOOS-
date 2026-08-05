# Benchmark Reference — Queue, Event Streaming & Cache

Governs: [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](../docs/004-TECHNOLOGY-SELECTION-RECORD.md) §3.6, §3.7, §3.8

**Note on methodology:** directional figures from vendor documentation and commonly cited industry benchmarks, not AOS-measured.

## Event Streaming

| Dimension                                                | NATS JetStream                                               | Kafka                                                                                | RabbitMQ                                    |
| -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| Single-broker throughput (messages/sec, typical payload) | Very high                                                    | Very high                                                                            | Medium-High                                 |
| Operational complexity (single-region cluster)           | Low (single binary, no external coordination service)        | Medium-High (historically ZooKeeper; KRaft mode reduces but does not eliminate this) | Low-Medium                                  |
| Built-in replay/log semantics                            | Yes (JetStream streams)                                      | Yes (native log model)                                                               | No (requires plugin/pattern workarounds)    |
| Consumer-group/partition ecosystem maturity              | Growing                                                      | Very mature (widest tooling ecosystem)                                               | Mature (different model — exchanges/queues) |
| Multi-tenant subject/topic isolation                     | Native subject hierarchy, straightforward per-tenant scoping | Topic-per-tenant or shared-topic-with-partition-key patterns, both well-established  | Vhost-per-tenant pattern well-established   |

**Relevance to AOS (§3.7/§3.8):** NATS JetStream's lower operational floor (no external coordination service required, single binary to run) is the deciding factor for AOS's actual near-term event volume; Kafka's advantage — a wider, more battle-tested ecosystem at very large scale — is exactly the property that becomes relevant only once AOS's event volume genuinely outgrows JetStream, which is why Kafka is documented as the migration path rather than dismissed.

## Cache

| Dimension                              | Redis (post-relicense)                | Valkey                                                 | DragonflyDB                                                                                          |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Protocol compatibility                 | Native (reference implementation)     | Full (fork, drop-in)                                   | High (implements Redis protocol)                                                                     |
| Threading model                        | Single-threaded core (per shard)      | Single-threaded core (per shard, inherited from Redis) | Multi-threaded (shares nothing architecture)                                                         |
| Throughput per node (typical workload) | High                                  | High (comparable to Redis at fork point)               | Higher (multi-threaded design claims multi-fold improvement on multi-core hardware)                  |
| License                                | RSALv2 / SSPL dual license (post-7.4) | BSD-3-Clause (Linux Foundation governed)               | Business Source License (source-available, converts to open license after a time period per version) |

**Relevance to AOS (§3.6):** Valkey's BSD license is the deciding factor over both Redis (licensing risk) and DragonflyDB (BSL is more permissive than Redis's current license but still not a fully permissive OSS license at the most recent versions) for the default recommendation; DragonflyDB's throughput advantage is real and is why it remains the named future upgrade path once the team has operational confidence in it at AOS's own workload shape.
