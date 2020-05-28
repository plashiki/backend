import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'
import { snakeCase } from 'typeorm/util/StringUtils'

export class TheNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    joinColumnName (relationName: string, referencedColumnName: string): string {
        return `${snakeCase(relationName)}_${referencedColumnName}`
    }
}
